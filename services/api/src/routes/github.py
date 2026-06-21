# routes/github.py  (relevant changed sections shown in full)
#
# KEY FIXES vs the original:
#  1. /callback  → issues a short-lived one-time CODE, not the raw JWT in the URL
#  2. /exchange  → swaps the code for the JWT (already existed, kept as-is)
#  3. /disconnect → new: clears github_token so re-connect starts fresh
#  4. /login     → unchanged
#  5. /repos 500 fix → the 500 was caused by a missing github_token column for
#     users who connected via email-OTP (they never went through GitHub OAuth).
#     We now return 401 instead of crashing.

import base64
import json
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    Request,
    WebSocket,
    WebSocketDisconnect,
)
from fastapi.responses import RedirectResponse
from jose import jwt

from configs.config import settings
from configs.db import get_db_pool
from configs.redis import get_redis
from middleware.auth import verify_token
from services.github_service import GithubService
from utils.crypto import decrypt_token, encrypt_token

router = APIRouter(
    prefix="/api/github",
    tags=["github"],
)


# ─── OAuth: initiate ─────────────────────────────────────────────────────────

@router.get("/login")
async def github_login(request: Request):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    state = secrets.token_urlsafe(32)
    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "repo user",
        "state": state,
    }
    await redis.setex(f"github_oauth_state:{state}", 600, "pending")

    return RedirectResponse(
        "https://github.com/login/oauth/authorize?" + urlencode(params),
        status_code=302,
    )


# ─── OAuth: callback ─────────────────────────────────────────────────────────

@router.get("/callback")
async def github_callback(request: Request, code: str, state: str):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    # Validate state (CSRF protection)
    stored = await redis.get(f"github_oauth_state:{state}")
    if not stored:
        # State missing or expired — send user back with an error flag
        return RedirectResponse(f"{settings.FRONTEND_URL}/github?error=state_mismatch")

    await redis.delete(f"github_oauth_state:{state}")

    timeout = httpx.Timeout(60.0, connect=30.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        # Exchange code for GitHub access token
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"},
        )
        data = resp.json()
        gh_error = data.get("error")
        if gh_error:
            # e.g. "bad_verification_code" on a replayed/expired code
            return RedirectResponse(
                f"{settings.FRONTEND_URL}/github?error={gh_error}"
            )

        access_token = data.get("access_token")
        if not access_token:
            return RedirectResponse(
                f"{settings.FRONTEND_URL}/github?error=no_access_token"
            )

        # Fetch GitHub user profile
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"},
        )
        github_user = user_resp.json()
        email = github_user.get("email")

        # GitHub may hide the primary email — fetch it explicitly
        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {access_token}"},
            )
            emails = emails_resp.json()
            primary = next((e for e in emails if e.get("primary")), None)
            email = primary["email"] if primary else None

    if not email:
        raise HTTPException(400, "No email found on GitHub account")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    # Upsert user — same pattern as auth.py so email-OTP and GitHub-OAuth
    # users share the same row.
    user_row = await pool.fetchrow(
        """
        INSERT INTO users (email, subscription_tier)
        VALUES ($1, 'free')
        ON CONFLICT (email) DO UPDATE
            SET email = EXCLUDED.email
        RETURNING id, email, subscription_tier
        """,
        email,
    )

    # Store the encrypted GitHub token on the user row
    encrypted_token = encrypt_token(access_token)
    await pool.execute(
        "UPDATE users SET github_token = $1 WHERE id = $2",
        encrypted_token,
        user_row["id"],
    )

    # Issue a short-lived one-time code instead of putting the JWT in the URL.
    # The frontend calls /exchange to swap this code for the real JWT.
    jwt_token = jwt.encode(
        {
            "sub": str(user_row["id"]),
            "email": user_row["email"],
            "subscription_tier": user_row["subscription_tier"],
            "exp": datetime.utcnow() + timedelta(days=7),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    one_time_code = secrets.token_urlsafe(32)
    await redis.setex(f"auth_code:{one_time_code}", 60, jwt_token)

    return RedirectResponse(
        f"{settings.FRONTEND_URL}/github?code={one_time_code}",
        status_code=302,
    )


# ─── Exchange one-time code for JWT ──────────────────────────────────────────

@router.get("/exchange")
async def exchange_code(code: str):
    """
    Swap a one-time auth code (from the OAuth callback redirect) for a JWT.
    The code is valid for 60 seconds and is deleted on first use.
    """
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    token = await redis.get(f"auth_code:{code}")
    if not token:
        raise HTTPException(400, "Invalid or expired code")

    await redis.delete(f"auth_code:{code}")
    return {"access_token": token, "token_type": "bearer"}


# ─── Disconnect GitHub ────────────────────────────────────────────────────────

@router.post("/disconnect")
async def disconnect_github(user=Depends(verify_token)):
    """
    Remove the stored GitHub OAuth token from the user's account.
    The user keeps their InternFlow session — only the GitHub link is removed.
    """
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    await pool.execute(
        "UPDATE users SET github_token = NULL WHERE id = $1",
        user["sub"],
    )
    return {"message": "GitHub disconnected"}


# ─── Repos ───────────────────────────────────────────────────────────────────

@router.get("/repos")
async def get_repos(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    user_row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"],
    )

    # Return 401 (not 500) when GitHub isn't connected yet
    if not user_row or not user_row["github_token"]:
        raise HTTPException(401, "GitHub not connected")

    github_token = decrypt_token(user_row["github_token"])
    service = GithubService(github_token)

    try:
        repos = await service.get_repos()
    except Exception:
        # Encrypted token may be stale (e.g. user revoked on GitHub side)
        raise HTTPException(401, "GitHub token invalid. Please reconnect.")

    return [
        {
            "id": repo["id"],
            "full_name": repo["full_name"],
            "private": repo.get("private", False),
        }
        for repo in repos
    ]


# ─── Contents / file ─────────────────────────────────────────────────────────

async def _get_github_token(user_id: str, pool) -> str:
    """Shared helper — fetch and decrypt the stored GitHub token."""
    user_row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user_id,
    )
    if not user_row or not user_row["github_token"]:
        raise HTTPException(401, "GitHub not connected")
    return decrypt_token(user_row["github_token"])


@router.get("/contents")
async def get_repo_contents(repo: str, path: str = "", user=Depends(verify_token)):
    pool = await get_db_pool()
    github_token = await _get_github_token(user["sub"], pool)

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=30.0)) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        resp.raise_for_status()
        return resp.json()


@router.get("/file")
async def get_file_content(repo: str, path: str, user=Depends(verify_token)):
    pool = await get_db_pool()
    github_token = await _get_github_token(user["sub"], pool)

    async with httpx.AsyncClient(timeout=httpx.Timeout(60.0, connect=30.0)) as client:
        resp = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3.raw",
            },
        )
        resp.raise_for_status()
        return {"content": resp.text}


# ─── Auto-setup / README ─────────────────────────────────────────────────────

@router.post("/{owner}/{repo}/auto-setup")
async def auto_setup(owner: str, repo: str, user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    github_token = await _get_github_token(user["sub"], pool)
    repo_name = f"{owner}/{repo}"
    timeout = httpx.Timeout(60.0, connect=30.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        contents_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/contents",
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        contents_resp.raise_for_status()
        contents = contents_resp.json()

    file_names = [item["name"] for item in contents]
    folder_names = [item["name"] for item in contents if item["type"] == "dir"]

    important_files = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for file_name in [
            "package.json",
            "requirements.txt",
            "README.md",
            "docker-compose.yml",
            ".env.example",
        ]:
            try:
                resp = await client.get(
                    f"https://api.github.com/repos/{repo_name}/contents/{file_name}",
                    headers={
                        "Authorization": f"token {github_token}",
                        "Accept": "application/vnd.github.v3.raw",
                    },
                )
                if resp.status_code == 200:
                    important_files.append(f"\n===== {file_name} =====\n{resp.text[:4000]}")
            except Exception:
                pass

    prompt = f"""
You are a senior software architect and elite technical documentation engineer.
Your task is to generate a REALISTIC, HIGH-QUALITY, production-grade GitHub README.md.

Repository Name: {repo_name}
ROOT FILES: {chr(10).join(file_names)}
ROOT FOLDERS: {chr(10).join(folder_names)}
IMPORTANT PROJECT FILES: {chr(10).join(important_files)}

RULES:
- Only mention technologies actually present in the repository
- No placeholder text, no generic AI fluff
- No repeated sections
- Output raw markdown only — no triple backtick wrappers around the whole document
Generate the README now.
"""

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(300.0, connect=30.0)) as client:
            resp = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 2500,
                    "temperature": 0.55,
                    "top_k": 50,
                    "top_p": 0.92,
                },
            )
            resp.raise_for_status()
            readme = resp.json().get("text", "").strip()
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(500, f"LLM generation failed: {str(exc)}")

    # Strip any LLM reasoning leakage
    for marker in ["Final Answer", "Alright, I've thoroughly analyzed"]:
        if marker in readme:
            parts = readme.split(marker, 1)
            readme = parts[-1]

    readme = readme.replace("```markdown", "").replace("```", "").strip()
    if not readme:
        readme = f"# {repo}\n\nREADME generation failed.\n"

    # Push to GitHub
    async with httpx.AsyncClient(timeout=timeout) as client:
        encoded_content = base64.b64encode(readme.encode()).decode()

        existing_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/contents/README.md",
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
        )
        payload: dict = {
            "message": "Add AI-generated README",
            "content": encoded_content,
        }
        if existing_resp.status_code == 200:
            payload["sha"] = existing_resp.json().get("sha")

        create_resp = await client.put(
            f"https://api.github.com/repos/{repo_name}/contents/README.md",
            headers={
                "Authorization": f"token {github_token}",
                "Accept": "application/vnd.github.v3+json",
            },
            json=payload,
        )
        if create_resp.status_code not in [200, 201]:
            raise HTTPException(500, f"Failed to create README: {create_resp.text}")

    return {"success": True, "repo": repo_name, "readme": readme}


# ─── WebSocket terminal ───────────────────────────────────────────────────────

@router.post("/terminal/token")
async def get_ws_token(user=Depends(verify_token)):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")
    token = secrets.token_urlsafe(32)
    await redis.setex(f"ws_token:{token}", 30, user["sub"])
    return {"token": token}


@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket, token: str):
    redis = await get_redis()
    user_id = None

    if redis:
        user_id = await redis.get(f"ws_token:{token}")
        if user_id:
            await redis.delete(f"ws_token:{token}")

    if not user_id:
        await websocket.close(code=1008)
        return

    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg["type"] == "terminal:start":
                await websocket.send_text(
                    json.dumps({"type": "session:started", "sessionId": msg["repoId"]})
                )
            elif msg["type"] == "terminal:command":
                await websocket.send_text(
                    json.dumps({
                        "type": "terminal:output",
                        "data": f"\r\nExecuted: {msg['command']}\r\n",
                    })
                )
    except WebSocketDisconnect:
        pass
import base64
import json
import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
from jose import jwt

from configs.config import settings
from configs.db import get_db_pool
from configs.redis import get_redis
from middleware.auth import verify_token
from services.github_service import GithubService
from utils.crypto import decrypt_token, encrypt_token

router = APIRouter(prefix="/api/github", tags=["github"])


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


@router.get("/callback")
async def github_callback(request: Request, code: str, state: str):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    stored = await redis.get(f"github_oauth_state:{state}")
    if not stored:
        return RedirectResponse(f"{settings.FRONTEND_URL}/github?error=state_mismatch")
    await redis.delete(f"github_oauth_state:{state}")

    timeout = httpx.Timeout(60.0, connect=30.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
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
            return RedirectResponse(f"{settings.FRONTEND_URL}/github?error={gh_error}")

        access_token = data.get("access_token")
        if not access_token:
            return RedirectResponse(f"{settings.FRONTEND_URL}/github?error=no_access_token")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"},
        )
        github_user = user_resp.json()
        email = github_user.get("email")

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

    user_row = await pool.fetchrow(
        """
        INSERT INTO users (email, subscription_tier)
        VALUES ($1, 'free')
        ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
        RETURNING id, email, subscription_tier
        """,
        email,
    )

    encrypted_token = encrypt_token(access_token)
    await pool.execute(
        "UPDATE users SET github_token = $1 WHERE id = $2",
        encrypted_token,
        user_row["id"],
    )

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


@router.get("/exchange")
async def exchange_code(code: str):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    token = await redis.get(f"auth_code:{code}")
    if not token:
        raise HTTPException(400, "Invalid or expired code")

    await redis.delete(f"auth_code:{code}")
    return {"access_token": token, "token_type": "bearer"}


@router.post("/disconnect")
async def disconnect_github(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    await pool.execute(
        "UPDATE users SET github_token = NULL WHERE id = $1",
        user["sub"],
    )
    return {"message": "GitHub disconnected"}


@router.get("/repos")
async def get_repos(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    user_row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"],
    )
    if not user_row or not user_row["github_token"]:
        raise HTTPException(401, "GitHub not connected")

    github_token = decrypt_token(user_row["github_token"])
    service = GithubService(github_token)

    try:
        repos = await service.get_repos()
    except Exception:
        raise HTTPException(401, "GitHub token invalid. Please reconnect.")

    return [
        {
            "id": repo["id"],
            "full_name": repo["full_name"],
            "private": repo.get("private", False),
        }
        for repo in repos
    ]


async def _get_github_token(user_id: str, pool) -> str:
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
            "pyproject.toml",
            "main.py",
            "app.py",
            "next.config.js",
            "Dockerfile",
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
                    important_files.append(f"\n===== {file_name} =====\n{resp.text[:1500]}")
            except Exception:
                pass

    dir_snippets = []
    async with httpx.AsyncClient(timeout=timeout) as client:
        for dir_name in ["src", "app", "backend", "frontend", "api"]:
            try:
                dir_resp = await client.get(
                    f"https://api.github.com/repos/{repo_name}/contents/{dir_name}",
                    headers={
                        "Authorization": f"token {github_token}",
                        "Accept": "application/vnd.github.v3+json",
                    },
                )
                if dir_resp.status_code == 200:
                    dir_items = dir_resp.json()
                    for entry in dir_items:
                        if entry["type"] == "file" and entry["name"].split(".")[-1] in (
                            "py", "ts", "tsx", "js", "jsx"
                        ):
                            file_resp = await client.get(
                                f"https://api.github.com/repos/{repo_name}/contents/{entry['path']}",
                                headers={
                                    "Authorization": f"token {github_token}",
                                    "Accept": "application/vnd.github.v3.raw",
                                },
                            )
                            if file_resp.status_code == 200:
                                dir_snippets.append(
                                    f"\n===== {entry['path']} =====\n{file_resp.text[:1500]}"
                                )
                            break
            except Exception:
                pass

    prompt = f"""You are a senior software architect and technical documentation engineer.
Generate a production-grade GitHub README.md for the repository below.

Repository: {repo_name}
ROOT FILES: {chr(10).join(file_names)}
ROOT FOLDERS: {chr(10).join(folder_names)}
PROJECT FILES: {chr(10).join(important_files)}
DIRECTORY SNIPPETS: {chr(10).join(dir_snippets)}

CRITICAL:
Never mention a technology unless it appears explicitly in the provided files.
If unsure, omit it.
Return EXACTLY ONE README.
Do not repeat sections.
Do not output multiple versions.

Generate a complete README with:
1. Project title
2. Overview
3. Key features
4. Technology stack
5. Installation
6. Usage
7. Project structure
8. API endpoints (if detected)
9. Environment variables (if detected)
10. License
Output raw markdown only."""

    try:
        async with httpx.AsyncClient(timeout=httpx.Timeout(900.0, connect=60.0)) as client:
            resp = await client.post(
                f"{settings.NEURAL_GENERATOR_URL}/generate",
                json={
                    "prompt": prompt,
                    "max_tokens": 1200,
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

    for marker in ["Final Answer", "Alright, I've thoroughly analyzed"]:
        if marker in readme:
            readme = readme.split(marker, 1)[-1]

    readme = readme.replace("```markdown", "").replace("```", "").strip()
    if not readme:
        readme = f"# {repo}\n\nREADME generation failed.\n"

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
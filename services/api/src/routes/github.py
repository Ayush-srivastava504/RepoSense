import asyncio
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
from services.job_queue import create_job, run_readme_job
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

    job_id = await create_job(
        user_id=user["sub"],
        job_type="readme",
        payload={"repo": repo_name},
    )

    asyncio.create_task(
        run_readme_job(
            job_id=job_id,
            user_id=user["sub"],
            github_token=github_token,
            repo_name=repo_name,
        )
    )

    return {"job_id": job_id, "status": "pending"}


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
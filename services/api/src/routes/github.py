from fastapi import APIRouter, Request, HTTPException, Depends, WebSocket, WebSocketDisconnect
from fastapi.responses import RedirectResponse
import secrets
import httpx
import json
import base64
from urllib.parse import urlencode
from datetime import datetime, timedelta
from ..configs.config import settings
from ..configs.redis import get_redis
from ..utils.crypto import encrypt_token, decrypt_token
from ..configs.db import get_db_pool
from ..middleware.auth import verify_token
from ..services.github_service import GithubService

router = APIRouter(prefix="/api/github", tags=["github"])

ws_tokens = {}


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

    redirect_url = f"https://github.com/login/oauth/authorize?{urlencode(params)}"
    return RedirectResponse(redirect_url, status_code=302)


@router.get("/callback")
async def github_callback(request: Request, code: str, state: str):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    stored = await redis.get(f"github_oauth_state:{state}")
    if not stored:
        return RedirectResponse(f"{settings.FRONTEND_URL}/github")

    await redis.delete(f"github_oauth_state:{state}")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={"Accept": "application/json"}
        )

        data = resp.json()
        access_token = data.get("access_token")

    async with httpx.AsyncClient() as client:
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {access_token}"}
        )
        github_user = user_resp.json()

        email = github_user.get("email")

        if not email:
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {access_token}"}
            )
            emails = emails_resp.json()
            primary = next((e for e in emails if e["primary"]), None)
            email = primary["email"] if primary else None

    if not email:
        raise HTTPException(400, "No email found")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    user_row = await pool.fetchrow(
        "SELECT id, email, subscription_tier FROM users WHERE email = $1",
        email
    )

    if not user_row:
        from passlib.context import CryptContext
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

        fake_hash = pwd_context.hash(secrets.token_urlsafe(16))

        user_row = await pool.fetchrow(
            "INSERT INTO users (email, password_hash, subscription_tier) VALUES ($1, $2, $3) RETURNING id, email, subscription_tier",
            email, fake_hash, "free"
        )

    user_id = user_row["id"]

    encrypted_token = encrypt_token(access_token)

    await pool.execute(
        "UPDATE users SET github_token = $1 WHERE id = $2",
        encrypted_token,
        user_id
    )

    from jose import jwt

    payload = {
        "sub": str(user_id),
        "email": user_row["email"],
        "subscription_tier": user_row["subscription_tier"],
        "exp": datetime.utcnow() + timedelta(days=7)
    }

    jwt_token = jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")

    redirect_url = f"{settings.FRONTEND_URL}/github?token={jwt_token}"
    return RedirectResponse(redirect_url, status_code=302)


@router.get("/repos")
async def get_repos(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"]
    )

    if not row or not row["github_token"]:
        raise HTTPException(400, "GitHub not connected")

    token = decrypt_token(row["github_token"])

    gh = GithubService(token)
    repos = await gh.get_repos()

    return repos


@router.post("/terminal/token")
async def get_ws_token(user=Depends(verify_token)):
    token = secrets.token_urlsafe(32)
    ws_tokens[token] = {
        "user_id": user["sub"],
        "expires": datetime.utcnow() + timedelta(seconds=30)
    }
    return {"token": token}


@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket, token: str):
    if token not in ws_tokens or ws_tokens[token]["expires"] < datetime.utcnow():
        await websocket.close(code=1008)
        return

    await websocket.accept()

    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)

            if msg["type"] == "terminal:start":
                await websocket.send_text(json.dumps({
                    "type": "session:started",
                    "sessionId": msg["repoId"]
                }))

            elif msg["type"] == "terminal:command":
                await websocket.send_text(json.dumps({
                    "type": "terminal:output",
                    "data": f"\r\nExecuted: {msg['command']}\r\n"
                }))

    except WebSocketDisconnect:
        pass

@router.get("/contents")
async def get_repo_contents(repo: str, path: str = "", user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"]
    )

    if not row or not row["github_token"]:
        raise HTTPException(400, "GitHub not connected")

    token = decrypt_token(row["github_token"])

    url = f"https://api.github.com/repos/{repo}/contents/{path}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"token {token}"}
        )
        return resp.json()


@router.get("/file")
async def get_file_content(repo: str, path: str, user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"]
    )

    if not row or not row["github_token"]:
        raise HTTPException(400, "GitHub not connected")

    token = decrypt_token(row["github_token"])

    url = f"https://api.github.com/repos/{repo}/contents/{path}"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            headers={"Authorization": f"token {token}"}
        )
        data = resp.json()

    content = base64.b64decode(data["content"]).decode("utf-8")

    return {"content": content}
@router.post("/index-repo")
async def index_github_repo(repo: str, user=Depends(verify_token)):
    pool = await get_db_pool()
    row = await pool.fetchrow("SELECT github_token FROM users WHERE id = $1", user["sub"])
    token = decrypt_token(row["github_token"])

    # Fetch all file contents (simplified, use recursive tree)
    async with httpx.AsyncClient() as client:
        tree_resp = await client.get(
            f"https://api.github.com/repos/{repo}/git/trees/HEAD?recursive=1",
            headers={"Authorization": f"token {token}"}
        )
        tree = tree_resp.json()
        files = []
        for item in tree["tree"]:
            if item["type"] == "blob" and item["path"].endswith((".py", ".js", ".ts", ".java", ".go")):
                content_resp = await client.get(
                    item["url"],
                    headers={"Authorization": f"token {token}"}
                )
                data = content_resp.json()
                content = base64.b64decode(data["content"]).decode("utf-8")
                files.append({"path": item["path"], "content": content})

    # Call RAG service
    rag_url = "http://rag:8001/api/rag/index"
    async with httpx.AsyncClient() as client:
        await client.post(rag_url, json={"repo_name": repo, "files": files})
    return {"status": "indexing started"}
@router.post("/{repo_name}/auto-setup")
async def auto_setup_repo(repo_name: str, user=Depends(verify_token)):
    # 1. Index the repo (fetch files and call RAG index)
    pool = await get_db_pool()
    row = await pool.fetchrow("SELECT github_token FROM users WHERE id = $1", user["sub"])
    if not row or not row["github_token"]:
        raise HTTPException(400, "GitHub not connected")
    token = decrypt_token(row["github_token"])

    # Fetch all code files (simplified – use tree API)
    async with httpx.AsyncClient() as client:
        tree_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/git/trees/HEAD?recursive=1",
            headers={"Authorization": f"token {token}"}
        )
        tree = tree_resp.json()
        files = []
        for item in tree.get("tree", []):
            if item["type"] == "blob" and item["path"].endswith((".py", ".js", ".ts", ".java", ".go", ".rs", ".cpp")):
                content_resp = await client.get(item["url"], headers={"Authorization": f"token {token}"})
                data = content_resp.json()
                content = base64.b64decode(data["content"]).decode("utf-8")
                files.append({"path": item["path"], "content": content})

    # Call RAG index
    rag_url = f"{settings.RAG_SERVICE_URL}/api/rag/index"
    async with httpx.AsyncClient() as client:
        await client.post(rag_url, json={"repo_name": repo_name, "files": files})

    # 2. Generate README
    gen_url = f"{settings.RAG_SERVICE_URL}/api/rag/generate"
    async with httpx.AsyncClient() as client:
        resp = await client.post(gen_url, json={"repo_name": repo_name})
        readme = resp.json().get("readme", "")

    # 3. Store in database
    await pool.execute("""
        INSERT INTO repo_docs (repo_name, user_id, readme_content)
        VALUES ($1, $2, $3)
        ON CONFLICT (repo_name, user_id) DO UPDATE SET readme_content = $3, updated_at = NOW()
    """, repo_name, user["sub"], readme)

    return {"status": "readme generated", "readme": readme}
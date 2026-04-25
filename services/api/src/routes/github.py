from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException
from pydantic import BaseModel
from ..services.github_service import GithubService
from ..services.terminal_manager import TerminalSession
from ..middleware.auth import verify_token
from ..config.db import get_db_pool
from ..utils.crypto import encrypt_token, decrypt_token
from ..config.settings import settings
import secrets
from datetime import datetime, timedelta
import json

router = APIRouter(prefix="/api/github", tags=["github"])
ws_tokens = {}

@router.post("/terminal/token")
async def get_ws_token(user=Depends(verify_token)):
    token = secrets.token_urlsafe(32)
    ws_tokens[token] = {"user_id": user["sub"], "expires": datetime.utcnow() + timedelta(seconds=30)}
    return {"token": token}

@router.websocket("/terminal")
async def terminal_websocket(websocket: WebSocket, token: str):
    if token not in ws_tokens or ws_tokens[token]["expires"] < datetime.utcnow():
        await websocket.close(code=1008, reason="Invalid or expired token")
        return
    user_id = ws_tokens[token]["user_id"]
    del ws_tokens[token]
    await websocket.accept()
    session = None
    try:
        while True:
            data = await websocket.receive_text()
            msg = json.loads(data)
            if msg["type"] == "terminal:start":
                session = await TerminalSession(user_id, msg["repoId"]).start()
                await websocket.send_text(json.dumps({"type": "session:started", "sessionId": session.session_id}))
            elif msg["type"] == "terminal:command" and session:
                await session.write(msg["command"])
                out = await session.read()
                if out:
                    await websocket.send_text(json.dumps({"type": "terminal:output", "data": out}))
    except WebSocketDisconnect:
        if session:
            await session.stop()

@router.post("/connect")
async def connect_github(github_token: str, user=Depends(verify_token)):
    enc = encrypt_token(github_token)
    pool = await get_db_pool()
    await pool.execute("UPDATE users SET github_token = $1 WHERE id = $2", enc, user["sub"])
    return {"message": "GitHub connected"}

@router.get("/repos")
async def get_repos(user=Depends(verify_token)):
    pool = await get_db_pool()
    row = await pool.fetchrow("SELECT github_token FROM users WHERE id = $1", user["sub"])
    if not row or not row["github_token"]:
        raise HTTPException(400, "GitHub not connected")
    token = decrypt_token(row["github_token"])
    gh = GithubService(token)
    repos = await gh.get_repos()
    return repos
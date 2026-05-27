import base64
import json
import secrets
import sys

from pathlib import Path
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

from utils.crypto import (
    decrypt_token,
    encrypt_token,
)

router = APIRouter(
    prefix="/api/github",
    tags=["github"],
)


@router.get("/login")
async def github_login(request: Request):

    redis = await get_redis()

    if redis is None:
        raise HTTPException(
            503,
            "Redis unavailable",
        )

    state = secrets.token_urlsafe(32)

    params = {
        "client_id": settings.GITHUB_CLIENT_ID,
        "redirect_uri": settings.GITHUB_REDIRECT_URI,
        "scope": "repo user",
        "state": state,
    }

    await redis.setex(
        f"github_oauth_state:{state}",
        600,
        "pending",
    )

    redirect_url = (
        "https://github.com/login/oauth/authorize?"
        f"{urlencode(params)}"
    )

    return RedirectResponse(
        redirect_url,
        status_code=302,
    )


@router.get("/callback")
async def github_callback(
    request: Request,
    code: str,
    state: str,
):

    redis = await get_redis()

    if redis is None:
        raise HTTPException(
            503,
            "Redis unavailable",
        )

    stored = await redis.get(
        f"github_oauth_state:{state}"
    )

    if not stored:
        return RedirectResponse(
            f"{settings.FRONTEND_URL}/github"
        )

    await redis.delete(
        f"github_oauth_state:{state}"
    )

    timeout = httpx.Timeout(
        60.0,
        connect=30.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": settings.GITHUB_REDIRECT_URI,
            },
            headers={
                "Accept": "application/json",
            },
        )

        data = resp.json()

        access_token = data.get(
            "access_token"
        )

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Authorization": (
                    f"token {access_token}"
                )
            },
        )

        github_user = user_resp.json()

        email = github_user.get("email")

        if not email:

            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={
                    "Authorization": (
                        f"token {access_token}"
                    )
                },
            )

            emails = emails_resp.json()

            primary = next(
                (
                    e
                    for e in emails
                    if e["primary"]
                ),
                None,
            )

            email = (
                primary["email"]
                if primary
                else None
            )

    if not email:
        raise HTTPException(
            400,
            "No email found",
        )

    pool = await get_db_pool()

    if pool is None:
        raise HTTPException(
            503,
            "Database unavailable",
        )

    user_row = await pool.fetchrow(
        """
        SELECT
            id,
            email,
            subscription_tier
        FROM users
        WHERE email = $1
        """,
        email,
    )

    if not user_row:

        from passlib.context import (
            CryptContext,
        )

        pwd_context = CryptContext(
            schemes=["bcrypt"],
            deprecated="auto",
        )

        fake_hash = pwd_context.hash(
            secrets.token_urlsafe(16)
        )

        user_row = await pool.fetchrow(
            """
            INSERT INTO users (
                email,
                password_hash,
                subscription_tier
            )
            VALUES ($1, $2, $3)
            RETURNING
                id,
                email,
                subscription_tier
            """,
            email,
            fake_hash,
            "free",
        )

    user_id = user_row["id"]

    encrypted_token = encrypt_token(
        access_token
    )

    await pool.execute(
        """
        UPDATE users
        SET github_token = $1
        WHERE id = $2
        """,
        encrypted_token,
        user_id,
    )

    payload = {
        "sub": str(user_id),
        "email": user_row["email"],
        "subscription_tier": (
            user_row["subscription_tier"]
        ),
        "exp": (
            datetime.utcnow()
            + timedelta(days=7)
        ),
    }

    jwt_token = jwt.encode(
        payload,
        settings.JWT_SECRET,
        algorithm="HS256",
    )

    code = secrets.token_urlsafe(32)
    await redis.setex(
        f"auth_code:{code}",
        60,
        jwt_token
    )

    redirect_url = (
        f"{settings.FRONTEND_URL}/github"
        f"?code={code}"
    )

    return RedirectResponse(
        redirect_url,
        status_code=302,
    )


@router.get("/exchange")
async def exchange_code(code: str):
    """Exchange one-time code for JWT token.
    
    The /callback endpoint returns a temporary code valid for 60 seconds.
    The frontend exchanges this code for the actual JWT using this endpoint.
    This prevents the JWT from being exposed in browser history, server logs,
    or referrer headers. The code is single-use and expires automatically.
    
    Args:
        code: One-time authorization code from /callback redirect.
        
    Returns:
        Dictionary with 'access_token' and 'token_type' keys.
        
    Raises:
        HTTPException: 400 if code is invalid, expired, or already used.
        HTTPException: 503 if Redis is unavailable.
    """
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    token = await redis.get(f"auth_code:{code}")
    if not token:
        raise HTTPException(400, "Invalid or expired code")

    await redis.delete(f"auth_code:{code}")
    return {"access_token": token, "token_type": "bearer"}


@router.get("/repos")
async def get_repos(
    user=Depends(verify_token),
):

    pool = await get_db_pool()

    if pool is None:
        raise HTTPException(
            503,
            "Database unavailable",
        )

    user_row = await pool.fetchrow(
        """
        SELECT github_token
        FROM users
        WHERE id = $1
        """,
        user["sub"],
    )

    if (
        not user_row
        or not user_row["github_token"]
    ):
        raise HTTPException(
            401,
            "GitHub not connected",
        )

    github_token = decrypt_token(
        user_row["github_token"]
    )

    service = GithubService(
        github_token
    )

    repos = await service.get_repos()

    return [
        {
            "id": repo["id"],
            "full_name": repo["full_name"],
            "private": repo.get("private", False),
        }
        for repo in repos
    ]


@router.get("/contents")
async def get_repo_contents(
    repo: str,
    path: str = "",
    user=Depends(verify_token),
):

    pool = await get_db_pool()

    user_row = await pool.fetchrow(
        """
        SELECT github_token
        FROM users
        WHERE id = $1
        """,
        user["sub"],
    )

    if (
        not user_row
        or not user_row["github_token"]
    ):
        raise HTTPException(
            401,
            "GitHub not connected",
        )

    github_token = decrypt_token(
        user_row["github_token"]
    )

    timeout = httpx.Timeout(
        60.0,
        connect=30.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

        resp = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": (
                    f"token {github_token}"
                ),
                "Accept": (
                    "application/vnd.github.v3+json"
                ),
            },
        )

        resp.raise_for_status()

        return resp.json()


@router.get("/file")
async def get_file_content(
    repo: str,
    path: str,
    user=Depends(verify_token),
):

    pool = await get_db_pool()

    user_row = await pool.fetchrow(
        """
        SELECT github_token
        FROM users
        WHERE id = $1
        """,
        user["sub"],
    )

    if (
        not user_row
        or not user_row["github_token"]
    ):
        raise HTTPException(
            401,
            "GitHub not connected",
        )

    github_token = decrypt_token(
        user_row["github_token"]
    )

    timeout = httpx.Timeout(
        60.0,
        connect=30.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

        resp = await client.get(
            f"https://api.github.com/repos/{repo}/contents/{path}",
            headers={
                "Authorization": (
                    f"token {github_token}"
                ),
                "Accept": (
                    "application/vnd.github.v3.raw"
                ),
            },
        )

        resp.raise_for_status()

        return {
            "content": resp.text,
        }


@router.post("/{owner}/{repo}/auto-setup")
async def auto_setup(
    owner: str,
    repo: str,
    user=Depends(verify_token),
):

    pool = await get_db_pool()

    if pool is None:
        raise HTTPException(
            503,
            "Database unavailable",
        )

    user_row = await pool.fetchrow(
        """
        SELECT github_token
        FROM users
        WHERE id = $1
        """,
        user["sub"],
    )

    if (
        not user_row
        or not user_row["github_token"]
    ):
        raise HTTPException(
            401,
            "GitHub not connected",
        )

    github_token = decrypt_token(
        user_row["github_token"]
    )

    repo_name = f"{owner}/{repo}"

    timeout = httpx.Timeout(
        60.0,
        connect=30.0,
    )

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

        contents_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/contents",
            headers={
                "Authorization": (
                    f"token {github_token}"
                ),
                "Accept": (
                    "application/vnd.github.v3+json"
                ),
            },
        )

        contents_resp.raise_for_status()

        contents = contents_resp.json()

    file_names = [
        item["name"]
        for item in contents
    ]

    folder_names = [
        item["name"]
        for item in contents
        if item["type"] == "dir"
    ]

    important_files = []

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

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
                        "Authorization": (
                            f"token {github_token}"
                        ),
                        "Accept": (
                            "application/vnd.github.v3.raw"
                        ),
                    },
                )

                if resp.status_code == 200:

                    important_files.append(
                        f"\n===== {file_name} =====\n"
                        f"{resp.text[:4000]}"
                    )

            except Exception:
                pass

    prompt = f"""
You are a senior software architect and elite technical documentation engineer.

Your task is to generate a REALISTIC, HIGH-QUALITY, production-grade GitHub README.md.

IMPORTANT:
You MUST analyze the repository structure carefully before writing.

Repository Name:
{repo_name}

ROOT FILES:
{chr(10).join(file_names)}

ROOT FOLDERS:
{chr(10).join(folder_names)}

IMPORTANT PROJECT FILES:
{chr(10).join(important_files)}

STRICT REQUIREMENTS:

- DO NOT hallucinate technologies
- ONLY mention technologies actually present in repository context
- DO NOT invent APIs
- DO NOT invent infrastructure
- DO NOT repeat sections
- DO NOT repeat markdown blocks
- DO NOT generate placeholder text
- DO NOT generate generic AI fluff
- DO NOT say "high performance" unless evidence exists
- DO NOT say scalable unless architecture supports it
- DO NOT repeat the README multiple times
- DO NOT output triple backticks except for commands/code examples
- NEVER output analysis text
- NEVER explain your reasoning
- NEVER output "Final Answer"
- NEVER output chain-of-thought
- NEVER invent URLs
- NEVER invent external APIs

Generate the README now.
"""

    try:

        api_root = Path(__file__).resolve().parents[2]

        sys.path.append(
            str(api_root)
        )

        from neural_generator.src.app import llm

        output = llm(
            prompt,
            max_tokens=2500,
            temperature=0.55,
            top_k=50,
            top_p=0.92,
            repeat_penalty=1.2,
            stop=["</s>"],
        )

        readme = (
            output.get(
                "choices",
                [{}]
            )[0]
            .get("text", "")
            .strip()
        )

    except Exception as exc:

        import traceback

        traceback.print_exc()

        raise HTTPException(
            500,
            f"LLM generation failed: {str(exc)}"
        )

    if "Final Answer" in readme:
        readme = readme.split("Final Answer")[-1]

    if "Alright, I've thoroughly analyzed" in readme:
        readme = readme.split("```markdown")[-1]

    readme = readme.replace("```markdown", "")
    readme = readme.replace("```", "")
    readme = readme.strip()

    if not readme:

        readme = f"""# {repo}

README generation failed.
"""

    async with httpx.AsyncClient(
        timeout=timeout
    ) as client:

        encoded_content = base64.b64encode(
            readme.encode()
        ).decode()

        existing_readme_sha = None

        existing_resp = await client.get(
            f"https://api.github.com/repos/{repo_name}/contents/README.md",
            headers={
                "Authorization": (
                    f"token {github_token}"
                ),
                "Accept": (
                    "application/vnd.github.v3+json"
                ),
            },
        )

        if existing_resp.status_code == 200:

            existing_data = existing_resp.json()

            existing_readme_sha = existing_data.get("sha")

        payload = {
            "message": "Add AI-generated README",
            "content": encoded_content,
        }

        if existing_readme_sha:

            payload["sha"] = existing_readme_sha

        create_resp = await client.put(
            f"https://api.github.com/repos/{repo_name}/contents/README.md",
            headers={
                "Authorization": (
                    f"token {github_token}"
                ),
                "Accept": (
                    "application/vnd.github.v3+json"
                ),
            },
            json=payload,
        )

        if create_resp.status_code not in [200, 201]:

            raise HTTPException(
                500,
                f"Failed to create README: {create_resp.text}"
            )

    return {
        "success": True,
        "repo": repo_name,
        "readme": readme,
    }


@router.post("/terminal/token")
async def get_ws_token(
    user=Depends(verify_token),
):
    """Generate a one-time WebSocket token.
    
    Creates a temporary token stored in Redis valid for 30 seconds.
    Used by the frontend to establish a WebSocket connection to /terminal.
    The token is single-use and verified on connection before any communication.
    
    Args:
        user: Authenticated user from verify_token dependency.
        
    Returns:
        Dictionary with 'token' key containing the WebSocket token.
        
    Raises:
        HTTPException: 503 if Redis is unavailable.
    """
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Redis unavailable")

    token = secrets.token_urlsafe(32)
    await redis.setex(
        f"ws_token:{token}",
        30,
        user["sub"],
    )

    return {"token": token}


@router.websocket("/terminal")
async def terminal_websocket(
    websocket: WebSocket,
    token: str,
):
    """WebSocket endpoint for terminal session management.
    
    Accepts a WebSocket connection using a valid token from /terminal/token.
    The token is verified against Redis and consumed (deleted) immediately
    to prevent replay attacks. Handles terminal session startup and command
    execution messages in JSON format.
    
    Args:
        websocket: WebSocket connection from client.
        token: One-time WebSocket token from /terminal/token endpoint.
        
    Raises:
        Closes connection with code 1008 if token is invalid or expired.
    """
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

            if (
                msg["type"]
                == "terminal:start"
            ):

                await websocket.send_text(
                    json.dumps({
                        "type": (
                            "session:started"
                        ),
                        "sessionId": (
                            msg["repoId"]
                        ),
                    })
                )

            elif (
                msg["type"]
                == "terminal:command"
            ):

                await websocket.send_text(
                    json.dumps({
                        "type": (
                            "terminal:output"
                        ),
                        "data": (
                            "\r\nExecuted: "
                            f"{msg['command']}\r\n"
                        ),
                    })
                )

    except WebSocketDisconnect:
        pass
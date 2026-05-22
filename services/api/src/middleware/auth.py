# middleware/auth.py

from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

from configs.config import settings


security = HTTPBearer()


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=["HS256"],
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(401, "Invalid token")

        return payload

    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
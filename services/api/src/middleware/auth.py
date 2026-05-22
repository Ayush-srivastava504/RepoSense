"""
Authentication middleware and token verification.
This module provides JWT token verification and security utilities.
Auth routes (login, register) are in routes/auth.py
"""
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from ..configs.config import settings

security = HTTPBearer()

async def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    """Verify JWT token from Authorization header.
    
    Args:
        credentials: Bearer token from Authorization header
        
    Returns:
        Decoded JWT payload containing user info
        
    Raises:
        HTTPException(401) if token is invalid or expired
    """
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(401, "Invalid token")
        return payload
    except JWTError:
        raise HTTPException(401, "Invalid or expired token")
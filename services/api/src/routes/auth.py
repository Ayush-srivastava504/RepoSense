from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from ..config.db import get_db_pool
from ..config.settings import settings

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

class UserCreate(BaseModel):
    email: EmailStr
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

@router.post("/register")
async def register(user: UserCreate):
    pool = await get_db_pool()
    existing = await pool.fetchrow("SELECT id FROM users WHERE email = $1", user.email)
    if existing:
        raise HTTPException(400, "Email already registered")
    hashed = pwd_context.hash(user.password)
    await pool.execute("INSERT INTO users (email, password_hash) VALUES ($1, $2)", user.email, hashed)
    return {"message": "User created"}

@router.post("/login")
async def login(user: UserLogin):
    pool = await get_db_pool()
    db_user = await pool.fetchrow("SELECT id, email, password_hash, subscription_tier FROM users WHERE email = $1", user.email)
    if not db_user or not pwd_context.verify(user.password, db_user["password_hash"]):
        raise HTTPException(401, "Invalid credentials")
    token = jwt.encode(
        {"sub": str(db_user["id"]), "email": db_user["email"], "subscription_tier": db_user["subscription_tier"],
         "exp": datetime.utcnow() + timedelta(days=7)},
        settings.JWT_SECRET, algorithm="HS256"
    )
    return {"access_token": token, "token_type": "bearer"}
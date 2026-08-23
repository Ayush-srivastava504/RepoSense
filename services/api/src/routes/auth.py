# Module: src/routes/auth.py
# Defines class(es): OtpRequest, OtpVerify
# Defines function(s): _generate_otp, _make_jwt, request_otp, verify_otp, create_guest_session
#

import random
import string
import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel, EmailStr
from configs.config import settings
from configs.db import get_db_pool
from configs.redis import get_redis
from services.email_service import send_otp_email
router = APIRouter(prefix='/api/auth', tags=['auth'])
OTP_TTL_SECONDS = 600
OTP_LENGTH = 6

def _generate_otp() -> str:
    return ''.join(random.choices(string.digits, k=OTP_LENGTH))

def _make_jwt(user_id: str, email: str, tier: str) -> str:
    return jwt.encode({'sub': str(user_id), 'email': email, 'subscription_tier': tier, 'exp': datetime.utcnow() + timedelta(days=7)}, settings.JWT_SECRET, algorithm='HS256')

class OtpRequest(BaseModel):
    email: EmailStr

class OtpVerify(BaseModel):
    email: EmailStr
    otp: str

@router.post('/otp/request')
async def request_otp(body: OtpRequest):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, 'Cache unavailable')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    user_row = await pool.fetchrow("\n        INSERT INTO users (email, subscription_tier)\n        VALUES ($1, 'free')\n        ON CONFLICT (email) DO UPDATE\n            SET email = EXCLUDED.email   -- no-op, but returns the row\n        RETURNING id, email, subscription_tier\n        ", body.email)
    otp = _generate_otp()
    redis_key = f'otp:{body.email}'
    existing = await redis.ttl(redis_key)
    if existing and existing > OTP_TTL_SECONDS - 30:
        raise HTTPException(429, 'Please wait before requesting another code.')
    await redis.setex(redis_key, OTP_TTL_SECONDS, otp)
    await send_otp_email(body.email, otp)
    return {'message': 'Verification code sent'}

@router.post('/otp/verify')
async def verify_otp(body: OtpVerify):
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, 'Cache unavailable')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    redis_key = f'otp:{body.email}'
    stored_otp = await redis.get(redis_key)
    if not stored_otp:
        raise HTTPException(400, 'Code expired or not found. Request a new one.')
    import hmac
    if not hmac.compare_digest(str(stored_otp), body.otp.strip()):
        raise HTTPException(400, 'Invalid code.')
    await redis.delete(redis_key)
    user_row = await pool.fetchrow('SELECT id, email, subscription_tier FROM users WHERE email = $1', body.email)
    if not user_row:
        raise HTTPException(404, 'Account not found.')
    token = _make_jwt(user_row['id'], user_row['email'], user_row['subscription_tier'])
    return {'access_token': token, 'token_type': 'bearer'}

@router.post('/guest')
async def create_guest_session():
    if settings.REQUIRE_AUTH:
        raise HTTPException(403, 'Guest sessions are disabled.')
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    guest_email = f'guest-{uuid.uuid4().hex}@guest.intern-flow.in'
    user_row = await pool.fetchrow("\n        INSERT INTO users (email, subscription_tier, is_guest)\n        VALUES ($1, 'free', TRUE)\n        RETURNING id, email, subscription_tier\n        ", guest_email)
    token = _make_jwt(user_row['id'], user_row['email'], user_row['subscription_tier'])
    return {'access_token': token, 'token_type': 'bearer', 'is_guest': True}

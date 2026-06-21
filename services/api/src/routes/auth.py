# routes/auth.py
import random
import string
from datetime import datetime, timedelta

from fastapi import APIRouter, HTTPException
from jose import jwt
from pydantic import BaseModel, EmailStr

from configs.config import settings
from configs.db import get_db_pool
from configs.redis import get_redis

# Optional: swap this import for your actual email sender
# e.g. sendgrid, resend, smtp, etc.
from services.email_service import send_otp_email

router = APIRouter(
    prefix="/api/auth",
    tags=["auth"],
)

OTP_TTL_SECONDS = 600  # 10 minutes
OTP_LENGTH = 6


def _generate_otp() -> str:
    return "".join(random.choices(string.digits, k=OTP_LENGTH))


def _make_jwt(user_id: str, email: str, tier: str) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "email": email,
            "subscription_tier": tier,
            "exp": datetime.utcnow() + timedelta(days=7),
        },
        settings.JWT_SECRET,
        algorithm="HS256",
    )


# ─── Schemas ─────────────────────────────────────────────────────────────────

class OtpRequest(BaseModel):
    email: EmailStr


class OtpVerify(BaseModel):
    email: EmailStr
    otp: str


# ─── Endpoints ───────────────────────────────────────────────────────────────

@router.post("/otp/request")
async def request_otp(body: OtpRequest):
    """
    Create (or look up) the user, then send a 6-digit OTP to their email.
    No password required — email ownership is the credential.
    """
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Cache unavailable")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    # Upsert: create the user if they don't exist yet
    user_row = await pool.fetchrow(
        """
        INSERT INTO users (email, subscription_tier)
        VALUES ($1, 'free')
        ON CONFLICT (email) DO UPDATE
            SET email = EXCLUDED.email   -- no-op, but returns the row
        RETURNING id, email, subscription_tier
        """,
        body.email,
    )

    otp = _generate_otp()
    redis_key = f"otp:{body.email}"

    # Rate-limit: don't allow spamming (only one active OTP at a time)
    existing = await redis.ttl(redis_key)
    if existing and existing > (OTP_TTL_SECONDS - 30):
        raise HTTPException(429, "Please wait before requesting another code.")

    await redis.setex(redis_key, OTP_TTL_SECONDS, otp)

    # Send the email — implement send_otp_email in services/email_service.py
    await send_otp_email(body.email, otp)

    # Never return the OTP in the response
    return {"message": "Verification code sent"}


@router.post("/otp/verify")
async def verify_otp(body: OtpVerify):
    """
    Verify the OTP and return a signed JWT on success.
    The OTP is single-use and deleted immediately after a successful match.
    """
    redis = await get_redis()
    if redis is None:
        raise HTTPException(503, "Cache unavailable")

    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    redis_key = f"otp:{body.email}"
    stored_otp = await redis.get(redis_key)

    if not stored_otp:
        raise HTTPException(400, "Code expired or not found. Request a new one.")

    # Use constant-time comparison to prevent timing attacks
    import hmac
    if not hmac.compare_digest(str(stored_otp), body.otp.strip()):
        raise HTTPException(400, "Invalid code.")

    # Consume the OTP — single use only
    await redis.delete(redis_key)

    user_row = await pool.fetchrow(
        "SELECT id, email, subscription_tier FROM users WHERE email = $1",
        body.email,
    )
    if not user_row:
        raise HTTPException(404, "Account not found.")

    token = _make_jwt(
        user_row["id"],
        user_row["email"],
        user_row["subscription_tier"],
    )

    return {
        "access_token": token,
        "token_type": "bearer",
    }
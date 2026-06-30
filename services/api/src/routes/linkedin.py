"""
services/api/src/routes/linkedin.py

Premium feature: LinkedIn Profile Optimizer.

Checks a profile against 14 rules (see services/linkedin_rules.py), scores
it 0-100, and uses the same Qwen3 model as the resume builder
(NEURAL_GENERATOR_URL) to generate specific suggestions + a rewritten
headline/about.

Access:
  - Pro / Enterprise subscribers: unlimited.
  - Free users: 1 free analysis for life, then either upgrade
    (POST /subscription/create-checkout) or watch a rewarded ad
    (frontend ad SDK -> POST /linkedin/unlock/ad) to get one more credit.

GET  /api/linkedin/status        -> free/ad/pro quota state for the gate UI
POST /api/linkedin/unlock/ad      -> call once a rewarded ad finishes playing
POST /api/linkedin/analyze        -> kicks off analysis, returns {job_id}
GET  /api/linkedin/history        -> past analyses (score over time)

Analysis itself runs through the existing async_jobs pattern
(GET /api/async-jobs/{job_id}) since the LLM call can take 30-90s+ on the
on-prem Qwen3-0.6B model, same reasoning as resume generation.
"""

import asyncio
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from middleware.auth import verify_token
from configs.db import get_db_pool
from services.linkedin_service import LinkedInService
from services.job_queue import create_job, run_linkedin_job

router = APIRouter(prefix="/api/linkedin", tags=["linkedin"])


# ── schemas ──────────────────────────────────────────────────────────────────

class ExperienceEntry(BaseModel):
    title: str = ""
    company: str = ""
    bullets: List[str] = []

class EducationEntry(BaseModel):
    institution: str = ""
    degree: str = ""

class ProfileInput(BaseModel):
    headline: str = ""
    about: str = ""
    current_title: str = ""
    current_company: str = ""
    has_photo: bool = False
    has_banner: bool = False
    custom_url: bool = False
    experience: List[ExperienceEntry] = []
    education: List[EducationEntry] = []
    skills: List[str] = []
    certifications: List[str] = []
    projects: List[str] = []
    featured_items: int = 0
    recommendations_received: int = 0
    connections: int = 0
    open_to_work: bool = False


# ── routes ───────────────────────────────────────────────────────────────────

async def _get_pool_or_503():
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")
    return pool


@router.get("/status")
async def get_status(user=Depends(verify_token)):
    """Quota state used by the frontend to decide whether to show the
    paywall / "watch an ad" modal before letting the user submit the form."""
    pool = await _get_pool_or_503()
    tier = user.get("subscription_tier", "free")
    return await LinkedInService(pool).get_status(user["sub"], tier)


@router.post("/unlock/ad")
async def unlock_with_ad(user=Depends(verify_token)):
    """
    Call this after a rewarded ad finishes playing on the frontend.

    NOTE: in production this should be a server-to-server callback from the
    ad network (e.g. Google AdMob/IronSource Server-Side Verification, or a
    web rewarded-ads provider's webhook) so a user can't just call this
    endpoint directly to get free credits. This sandboxed implementation
    trusts the authenticated caller, which is fine for local/dev use but
    should be swapped for SSV verification before shipping.
    """
    pool = await _get_pool_or_503()
    new_total = await LinkedInService(pool).grant_ad_credit(user["sub"])
    return {"ad_credits": new_total}


@router.post("/analyze")
async def analyze_profile(data: ProfileInput, user=Depends(verify_token)):
    pool = await _get_pool_or_503()
    tier = user.get("subscription_tier", "free")
    service = LinkedInService(pool)

    unlock_method = await service.reserve_access(user["sub"], tier)
    if unlock_method is None:
        status = await service.get_status(user["sub"], tier)
        raise HTTPException(
            status_code=402,
            detail={
                "error": "upgrade_required",
                "message": "You've used your free LinkedIn optimization check. Upgrade to Pro or watch a quick ad to unlock another one.",
                "status": status,
            },
        )

    job_id = await create_job(
        user_id=user["sub"],
        job_type="linkedin",
        payload={"unlock_method": unlock_method, "profile": data.model_dump()},
    )
    asyncio.create_task(
        run_linkedin_job(
            job_id=job_id,
            user_id=user["sub"],
            unlock_method=unlock_method,
            profile=data.model_dump(),
        )
    )
    return {"job_id": job_id, "status": "pending", "unlock_method": unlock_method}


@router.get("/history")
async def get_history(user=Depends(verify_token)):
    pool = await _get_pool_or_503()
    return await LinkedInService(pool).get_history(user["sub"])

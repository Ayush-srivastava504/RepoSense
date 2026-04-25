from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..services.ai_service import AIService
from ..middleware.auth import verify_token

router = APIRouter(prefix="/api/v1", tags=["review"])

class ReviewRequest(BaseModel):
    code: str
    language: str = "python"

@router.post("/review")
async def review_code(req: ReviewRequest, user=Depends(verify_token)):
    ai = AIService()
    return await ai.review_code(req.code, req.language)

@router.post("/auto-fix")
async def auto_fix(req: ReviewRequest, user=Depends(verify_token)):
    ai = AIService()
    return await ai.auto_fix(req.code, req.language)

@router.get("/health")
async def health():
    return {"status": "alive"}
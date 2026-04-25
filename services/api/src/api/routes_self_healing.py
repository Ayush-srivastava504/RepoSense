from fastapi import APIRouter, Depends
from .routes import ReviewRequest
from ..services.ai_service import AIService
from ..services.validation_engine import ValidationEngine
from ..middleware.auth import verify_token

router = APIRouter(prefix="/api/v1/self-healing", tags=["self-healing"])

@router.post("/fix-and-validate")
async def fix_and_validate(req: ReviewRequest, user=Depends(verify_token)):
    ai = AIService()
    fix_res = await ai.auto_fix(req.code, req.language)
    val = ValidationEngine()
    validation = val.validate(fix_res.get('fixed_code', req.code), req.language, run_tests=False)
    return {"fix": fix_res, "validation": validation.__dict__}
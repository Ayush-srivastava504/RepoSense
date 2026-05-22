from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..services.resume_service import ResumeService
from ..middleware.auth import verify_token

router = APIRouter(prefix="/api/resume", tags=["resume"])

class ResumeData(BaseModel):
    title: str
    content: dict

# ---------------------------------------------------------------------------
# Primary endpoints – delegate all DB work to ``ResumeService`` which already
# handles connection pooling and error handling.
# ---------------------------------------------------------------------------

@router.post("/create")
async def create_resume(data: ResumeData, user=Depends(verify_token)):
    svc = ResumeService()
    try:
        return await svc.create_resume(user["sub"], data.title, data.content)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(503, f"Database unavailable: {str(exc)}") from exc

@router.get("/list")
async def list_resumes(user=Depends(verify_token)):
    svc = ResumeService()
    try:
        return await svc.list_resumes(user["sub"])
    except Exception as exc:
        raise HTTPException(503, "Database unavailable") from exc
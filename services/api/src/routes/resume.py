from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from ..services.resume_service import ResumeService
from ..middleware.auth import verify_token

router = APIRouter(prefix="/api/resume", tags=["resume"])

class ResumeData(BaseModel):
    title: str
    content: dict

@router.post("/create")
async def create_resume(data: ResumeData, user=Depends(verify_token)):
    svc = ResumeService()
    return await svc.create_resume(user["sub"], data.title, data.content)

@router.get("/list")
async def list_resumes(user=Depends(verify_token)):
    svc = ResumeService()
    return await svc.list_resumes(user["sub"])
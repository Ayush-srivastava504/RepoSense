from fastapi import APIRouter, Depends
from ..services.jobs_service import JobsService
from ..middleware.auth import verify_token

router = APIRouter(prefix="/api/jobs", tags=["jobs"])

@router.get("/")
async def get_jobs(limit: int = 20, offset: int = 0, user=Depends(verify_token)):
    svc = JobsService()
    return await svc.get_recent_jobs(limit, offset)
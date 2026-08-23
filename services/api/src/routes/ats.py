# Module: src/routes/ats.py
# Defines class(es): AtsCheckRequest
# Defines function(s): get_roles, check_resume
#

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from middleware.auth import verify_token
from services.ats_rules import list_roles, score_resume
router = APIRouter(prefix='/api/ats', tags=['ats'])

class AtsCheckRequest(BaseModel):
    resume_text: str = Field(..., min_length=1)
    role: str

@router.get('/roles')
async def get_roles():
    return {'roles': list_roles()}

@router.post('/check')
async def check_resume(data: AtsCheckRequest, user=Depends(verify_token)):
    try:
        return score_resume(data.resume_text, data.role)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

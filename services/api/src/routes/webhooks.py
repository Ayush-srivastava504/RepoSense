from fastapi import APIRouter, Request
import json
router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

@router.post("/github")
async def github_webhook(request: Request):
    body = await request.body()
    # process push event, trigger code review, etc.
    return {"status": "received"}
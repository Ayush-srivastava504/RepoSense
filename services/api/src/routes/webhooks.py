# Module: src/routes/webhooks.py
# Defines function(s): github_webhook
#
#

from fastapi import APIRouter, Request
import json
router = APIRouter(prefix='/api/webhooks', tags=['webhooks'])

@router.post('/github')
async def github_webhook(request: Request):
    body = await request.body()
    return {'status': 'received'}

# services/api/src/routes/async_jobs.py
# Two endpoints:
# GET  /api/async-jobs/{job_id}
# Poll job status.  Returns the full row so the frontend can branch on

import json
from fastapi import APIRouter, Depends, HTTPException
from configs.db import get_db_pool
from middleware.auth import verify_token
from services.job_queue import get_job
router = APIRouter(prefix='/api/async-jobs', tags=['async-jobs'])

@router.get('/{job_id}')
async def poll_job(job_id: str, user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await get_job(job_id, user['sub'])
    if row is None:
        raise HTTPException(404, 'Job not found')
    result = row.get('result')
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except Exception:
            pass
    return {'id': row['id'], 'type': row['type'], 'status': row['status'], 'result': result, 'error': row.get('error'), 'created_at': row['created_at'].isoformat() if row.get('created_at') else None, 'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else None}

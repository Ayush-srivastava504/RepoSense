"""
services/api/src/routes/async_jobs.py

Two endpoints:

  GET  /api/async-jobs/{job_id}
       Poll job status.  Returns the full row so the frontend can branch on
       status ∈ { pending, running, done, failed }.

  (Job creation happens inside the feature routes: github.py and resume.py
   call job_queue.create_job() and immediately return the job_id.)
"""

import json

from fastapi import APIRouter, Depends, HTTPException

from configs.db import get_db_pool
from middleware.auth import verify_token
from services.job_queue import get_job

router = APIRouter(prefix="/api/async-jobs", tags=["async-jobs"])


@router.get("/{job_id}")
async def poll_job(job_id: str, user=Depends(verify_token)):
    """
    Poll a background job.

    Response shape:
      { id, type, status, result, error, created_at, updated_at }

    `result` is a JSON object whose keys depend on job type:
      - readme:  { readme: "...", repo: "owner/name" }
      - resume:  { pdf_b64: "base64-encoded PDF bytes" }

    Frontend should keep polling while status ∈ { pending, running }.
    """
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await get_job(job_id, user["sub"])
    if row is None:
        raise HTTPException(404, "Job not found")

    # result and error are stored as JSONB / text – parse result if present
    result = row.get("result")
    if isinstance(result, str):
        try:
            result = json.loads(result)
        except Exception:
            pass

    return {
        "id": row["id"],
        "type": row["type"],
        "status": row["status"],
        "result": result,
        "error": row.get("error"),
        "created_at": row["created_at"].isoformat() if row.get("created_at") else None,
        "updated_at": row["updated_at"].isoformat() if row.get("updated_at") else None,
    }
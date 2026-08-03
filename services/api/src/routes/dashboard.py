import json

from fastapi import APIRouter, Depends, HTTPException

from configs.db import get_db_pool
from middleware.auth import verify_token

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats")
async def get_stats(user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    resumes_generated = await pool.fetchval(
        "SELECT COUNT(*) FROM resumes WHERE user_id = $1",
        user["sub"],
    )

    user_row = await pool.fetchrow(
        "SELECT github_token FROM users WHERE id = $1",
        user["sub"],
    )
    repos_connected = 1 if user_row and user_row["github_token"] else 0

    # Code-review runs are not persisted yet (see routes/review.py), so
    # review-derived stats default to zero/None rather than 404ing.
    return {
        "total_reviews": 0,
        "resumes_generated": resumes_generated or 0,
        "jobs_viewed": 0,
        "repos_connected": repos_connected,
        "avg_quality_score": None,
        "issues_found": 0,
    }


@router.get("/recent-reviews")
async def get_recent_reviews(limit: int = 5, user=Depends(verify_token)):
    # No review-history table exists yet — return an empty list instead of
    # 404ing so the dashboard can render its empty state.
    return []


@router.get("/recent-resumes")
async def get_recent_resumes(limit: int = 3, user=Depends(verify_token)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    rows = await pool.fetch(
        """
        SELECT id, title, content, created_at
        FROM resumes
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2
        """,
        user["sub"],
        limit,
    )

    def resume_type(raw_content) -> str:
        if not raw_content:
            return "resume"
        try:
            content = json.loads(raw_content) if isinstance(raw_content, str) else raw_content
            return content.get("resume_type", "resume")
        except (TypeError, ValueError):
            return "resume"

    return [
        {
            "id": str(row["id"]),
            "title": row["title"],
            "type": resume_type(row["content"]),
            "created_at": row["created_at"].isoformat(),
        }
        for row in rows
    ]

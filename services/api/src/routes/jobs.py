from fastapi import APIRouter
from fastapi import HTTPException

from configs.db import get_db_pool


router = APIRouter(
    prefix="/api/jobs",
    tags=["jobs"],
)


@router.get("/")
async def get_jobs(
    limit: int = 20,
    offset: int = 0,
):
    pool = await get_db_pool()

    if pool is None:
        raise HTTPException(
            503,
            "Database unavailable",
        )

    rows = await pool.fetch(
        """
        SELECT
            id,
            title,
            company,
            description,
            url,
            source,
            posted_at
        FROM jobs
        WHERE is_active = true
        ORDER BY posted_at DESC
        LIMIT $1
        OFFSET $2
        """,
        limit,
        offset,
    )

    return [
        dict(row)
        for row in rows
    ]
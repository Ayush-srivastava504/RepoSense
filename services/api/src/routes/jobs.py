from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool

router = APIRouter(
    prefix="/api/jobs",
    tags=["jobs"],
)


@router.get("/")
async def get_jobs(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    source: str | None = Query(default=None),
    search: str | None = Query(default=None),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    # Build dynamic WHERE clause
    conditions = ["is_active = true"]
    params: list = []

    if source:
        params.append(source)
        conditions.append(f"source = ${len(params)}")

    if search:
        params.append(f"%{search}%")
        n = len(params)
        # ILIKE hits the gin_trgm_ops indexes
        conditions.append(
            f"(title ILIKE ${n} OR company ILIKE ${n} OR description ILIKE ${n})"
        )

    where = "WHERE " + " AND ".join(conditions)

    # Total count for frontend hasMore logic
    total: int = await pool.fetchval(
        f"SELECT COUNT(*) FROM jobs {where}",
        *params,
    )

    # limit and offset are the next two positional params after filter params
    limit_pos  = len(params) + 1
    offset_pos = len(params) + 2

    rows = await pool.fetch(
        f"""
        SELECT
            id,
            title,
            company,
            description,
            url,
            source,
            posted_at,
            location,
            salary,
            stipend,
            type
        FROM jobs
        {where}
        ORDER BY posted_at DESC
        LIMIT ${limit_pos} OFFSET ${offset_pos}
        """,
        *params, limit, offset,
    )

    return {
        "jobs": [dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
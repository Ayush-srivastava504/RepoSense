from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool

router = APIRouter(
    prefix="/api/hackathons",
    tags=["hackathons"],
)

HACKATHON_COLUMNS = """
    id, title, slug, organizer, description,
    participation_mode, location, country, is_global, is_student_friendly,
    start_date, end_date, registration_deadline,
    prize_pool_text, prize_value_usd,
    team_size_min, team_size_max,
    eligibility, themes, submission_requirements,
    source, sources, source_url, apply_url, image_url,
    status, quality_score, trust_score,
    first_seen_at
"""

# ranking_score = quality_score*0.40 + deadline_relevance*0.25
#               + trust_score*0.20 + freshness_score*0.15
#
# deadline_relevance buckets a "days until deadline" figure rather than
# using it linearly, because a deadline in 20 minutes is technically
# urgent but rarely actionable for someone discovering the hackathon right
# now — see docs/HACKATHONS.md for the reasoning.
RANKING_EXPRESSION = """
    (
        COALESCE(quality_score, 0)::float * 0.40
        + (
            CASE
                WHEN registration_deadline IS NULL THEN 40
                WHEN registration_deadline < now() THEN 10
                WHEN registration_deadline - now() <= interval '1 day' THEN 60
                WHEN registration_deadline - now() <= interval '3 days' THEN 100
                WHEN registration_deadline - now() <= interval '7 days' THEN 90
                WHEN registration_deadline - now() <= interval '14 days' THEN 70
                WHEN registration_deadline - now() <= interval '30 days' THEN 50
                ELSE 30
            END
        ) * 0.25
        + COALESCE(trust_score, 0)::float * 0.20
        + (
            CASE
                WHEN first_seen_at > now() - interval '2 days' THEN 100
                WHEN first_seen_at > now() - interval '7 days' THEN 70
                WHEN first_seen_at > now() - interval '30 days' THEN 40
                ELSE 10
            END
        ) * 0.15
    )
"""


@router.get("/")
async def get_hackathons(
    limit: int = Query(default=20, ge=1, le=50),
    offset: int = Query(default=0, ge=0),
    mode: str | None = Query(default=None, description="online | offline | hybrid"),
    country: str | None = Query(default=None),
    theme: str | None = Query(default=None),
    status: str | None = Query(default=None, description="Defaults to upcoming+ongoing only"),
    search: str | None = Query(default=None),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    conditions = ["is_active = true"]
    params: list = []

    if status:
        params.append(status)
        conditions.append(f"status = ${len(params)}")
    else:
        conditions.append("status IN ('upcoming', 'ongoing')")

    if mode:
        params.append(mode)
        conditions.append(f"participation_mode = ${len(params)}")

    if country:
        params.append(country)
        conditions.append(f"lower(country) = lower(${len(params)})")

    if theme:
        params.append(theme)
        conditions.append(f"themes @> to_jsonb(ARRAY[${len(params)}::text])")

    if search:
        params.append(f"%{search}%")
        n = len(params)
        conditions.append(f"(title ILIKE ${n} OR organizer ILIKE ${n} OR description ILIKE ${n})")

    where = "WHERE " + " AND ".join(conditions)

    total: int = await pool.fetchval(f"SELECT COUNT(*) FROM hackathons {where}", *params)

    limit_pos = len(params) + 1
    offset_pos = len(params) + 2

    rows = await pool.fetch(
        f"""
        SELECT {HACKATHON_COLUMNS}
        FROM hackathons
        {where}
        ORDER BY {RANKING_EXPRESSION} DESC, registration_deadline ASC NULLS LAST
        LIMIT ${limit_pos} OFFSET ${offset_pos}
        """,
        *params, limit, offset,
    )

    return {
        "items": [dict(row) for row in rows],
        "total": total,
        "limit": limit,
        "offset": offset,
    }


@router.get("/featured")
async def get_featured_hackathons(
    limit: int = Query(default=6, ge=1, le=20),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    rows = await pool.fetch(
        f"""
        SELECT {HACKATHON_COLUMNS}
        FROM hackathons
        WHERE is_active = true
          AND status IN ('upcoming', 'ongoing')
          AND quality_score >= 75
        ORDER BY {RANKING_EXPRESSION} DESC
        LIMIT $1
        """,
        limit,
    )

    return {"items": [dict(row) for row in rows]}


@router.get("/ending-soon")
async def get_hackathons_ending_soon(
    limit: int = Query(default=20, ge=1, le=50),
):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    rows = await pool.fetch(
        f"""
        SELECT {HACKATHON_COLUMNS}
        FROM hackathons
        WHERE is_active = true
          AND status = 'upcoming'
          AND registration_deadline IS NOT NULL
          AND registration_deadline BETWEEN now() AND now() + interval '7 days'
        ORDER BY registration_deadline ASC
        LIMIT $1
        """,
        limit,
    )

    return {"items": [dict(row) for row in rows]}


@router.get("/{slug}")
async def get_hackathon(slug: str):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, "Database unavailable")

    row = await pool.fetchrow(
        f"SELECT {HACKATHON_COLUMNS} FROM hackathons WHERE slug = $1 AND is_active = true",
        slug,
    )

    if row is None:
        raise HTTPException(404, "Hackathon not found")

    return dict(row)

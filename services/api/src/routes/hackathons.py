# Module: src/routes/hackathons.py
# Defines function(s): get_hackathons, get_featured_hackathons, get_hackathons_ending_soon, get_hackathon
#
#

from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool
router = APIRouter(prefix='/api/hackathons', tags=['hackathons'])
HACKATHON_COLUMNS = '\n    id, title, slug, organizer, description,\n    participation_mode, location, country, is_global, is_student_friendly,\n    start_date, end_date, registration_deadline,\n    prize_pool_text, prize_value_usd,\n    team_size_min, team_size_max,\n    eligibility, themes, submission_requirements,\n    source, sources, source_url, apply_url, image_url,\n    status, quality_score, trust_score,\n    first_seen_at\n'
RANKING_EXPRESSION = "\n    (\n        COALESCE(quality_score, 0)::float * 0.40\n        + (\n            CASE\n                WHEN registration_deadline IS NULL THEN 40\n                WHEN registration_deadline < now() THEN 10\n                WHEN registration_deadline - now() <= interval '1 day' THEN 60\n                WHEN registration_deadline - now() <= interval '3 days' THEN 100\n                WHEN registration_deadline - now() <= interval '7 days' THEN 90\n                WHEN registration_deadline - now() <= interval '14 days' THEN 70\n                WHEN registration_deadline - now() <= interval '30 days' THEN 50\n                ELSE 30\n            END\n        ) * 0.25\n        + COALESCE(trust_score, 0)::float * 0.20\n        + (\n            CASE\n                WHEN first_seen_at > now() - interval '2 days' THEN 100\n                WHEN first_seen_at > now() - interval '7 days' THEN 70\n                WHEN first_seen_at > now() - interval '30 days' THEN 40\n                ELSE 10\n            END\n        ) * 0.15\n    )\n"

@router.get('/')
async def get_hackathons(limit: int=Query(default=20, ge=1, le=50), offset: int=Query(default=0, ge=0), mode: str | None=Query(default=None, description='online | offline | hybrid'), country: str | None=Query(default=None), theme: str | None=Query(default=None), status: str | None=Query(default=None, description='Defaults to upcoming+ongoing only'), search: str | None=Query(default=None)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    conditions = ['is_active = true']
    params: list = []
    if status:
        params.append(status)
        conditions.append(f'status = ${len(params)}')
    else:
        conditions.append("status IN ('upcoming', 'ongoing')")
    if mode:
        params.append(mode)
        conditions.append(f'participation_mode = ${len(params)}')
    if country:
        params.append(country)
        conditions.append(f'lower(country) = lower(${len(params)})')
    if theme:
        params.append(theme)
        conditions.append(f'themes @> to_jsonb(ARRAY[${len(params)}::text])')
    if search:
        params.append(f'%{search}%')
        n = len(params)
        conditions.append(f'(title ILIKE ${n} OR organizer ILIKE ${n} OR description ILIKE ${n})')
    where = 'WHERE ' + ' AND '.join(conditions)
    total: int = await pool.fetchval(f'SELECT COUNT(*) FROM hackathons {where}', *params)
    limit_pos = len(params) + 1
    offset_pos = len(params) + 2
    rows = await pool.fetch(f'\n        SELECT {HACKATHON_COLUMNS}\n        FROM hackathons\n        {where}\n        ORDER BY {RANKING_EXPRESSION} DESC, registration_deadline ASC NULLS LAST\n        LIMIT ${limit_pos} OFFSET ${offset_pos}\n        ', *params, limit, offset)
    return {'items': [dict(row) for row in rows], 'total': total, 'limit': limit, 'offset': offset}

@router.get('/featured')
async def get_featured_hackathons(limit: int=Query(default=6, ge=1, le=20)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch(f"\n        SELECT {HACKATHON_COLUMNS}\n        FROM hackathons\n        WHERE is_active = true\n          AND status IN ('upcoming', 'ongoing')\n          AND quality_score >= 75\n        ORDER BY {RANKING_EXPRESSION} DESC\n        LIMIT $1\n        ", limit)
    return {'items': [dict(row) for row in rows]}

@router.get('/ending-soon')
async def get_hackathons_ending_soon(limit: int=Query(default=20, ge=1, le=50)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch(f"\n        SELECT {HACKATHON_COLUMNS}\n        FROM hackathons\n        WHERE is_active = true\n          AND status = 'upcoming'\n          AND registration_deadline IS NOT NULL\n          AND registration_deadline BETWEEN now() AND now() + interval '7 days'\n        ORDER BY registration_deadline ASC\n        LIMIT $1\n        ", limit)
    return {'items': [dict(row) for row in rows]}

@router.get('/{slug}')
async def get_hackathon(slug: str):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow(f'SELECT {HACKATHON_COLUMNS} FROM hackathons WHERE slug = $1 AND is_active = true', slug)
    if row is None:
        raise HTTPException(404, 'Hackathon not found')
    return dict(row)

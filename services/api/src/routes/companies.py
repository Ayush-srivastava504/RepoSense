# Module: src/routes/companies.py
# Defines function(s): _lower_top_companies, get_companies, get_company_profile
#
#

from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool
from routes.jobs import TOP_COMPANY_TIER
router = APIRouter(prefix='/api/companies', tags=['companies'])
MASS_HIRE_THRESHOLD = 8
MAX_PER_SECTION = 60

def _lower_top_companies() -> list[str]:
    return [c.lower() for c in TOP_COMPANY_TIER]

@router.get('/')
async def get_companies(limit_per_section: int=Query(default=MAX_PER_SECTION, ge=1, le=200)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch("\n        SELECT\n            company,\n            count(*)                                   AS job_count,\n            bool_or(is_official_domain)                 AS is_official_domain,\n            (array_agg(apply_domain) FILTER (WHERE apply_domain IS NOT NULL))[1] AS apply_domain,\n            (array_agg(logo_domain) FILTER (WHERE logo_domain IS NOT NULL))[1]   AS logo_domain,\n            (array_agg(location) FILTER (WHERE location IS NOT NULL))[1]         AS sample_location,\n            max(posted_at)                              AS last_posted_at\n        FROM jobs\n        WHERE is_active = true AND company IS NOT NULL AND company != ''\n        GROUP BY company\n        ")
    top_companies = set(_lower_top_companies())
    top: list[dict] = []
    mass_hire: list[dict] = []
    startup: list[dict] = []
    for row in rows:
        entry = {'company': row['company'], 'job_count': row['job_count'], 'is_official_domain': row['is_official_domain'], 'apply_domain': row['apply_domain'], 'logo_domain': row['logo_domain'], 'sample_location': row['sample_location'], 'last_posted_at': row['last_posted_at']}
        if row['company'].lower() in top_companies:
            entry['tier'] = 'top'
            top.append(entry)
        elif row['job_count'] >= MASS_HIRE_THRESHOLD:
            entry['tier'] = 'mass_hire'
            mass_hire.append(entry)
        else:
            entry['tier'] = 'startup'
            startup.append(entry)
    top.sort(key=lambda c: c['company'].lower())
    mass_hire.sort(key=lambda c: c['job_count'], reverse=True)
    startup.sort(key=lambda c: (c['last_posted_at'] is not None, c['last_posted_at']), reverse=True)
    return {'top': {'companies': top[:limit_per_section], 'total': len(top)}, 'mass_hire': {'companies': mass_hire[:limit_per_section], 'total': len(mass_hire)}, 'startup': {'companies': startup[:limit_per_section], 'total': len(startup)}, 'mass_hire_threshold': MASS_HIRE_THRESHOLD}

@router.get('/{company}/profile')
async def get_company_profile(company: str):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow(
        'SELECT company, overview, culture_summary, review_snippets, keywords, model, enriched_at FROM company_profiles WHERE lower(company) = lower($1)',
        company,
    )
    if row is None:
        raise HTTPException(404, 'No enriched profile for this company yet')
    return dict(row)

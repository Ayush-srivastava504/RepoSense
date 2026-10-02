# Module: src/routes/companies.py
# Defines function(s): _lower_top_companies, get_companies, get_company_profile
#
#

import json

from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool
from routes.jobs import _freshness_conditions, _top_companies
from services.company_directory import directory_letter, sort_key
router = APIRouter(prefix='/api/companies', tags=['companies'])
MASS_HIRE_THRESHOLD = 8
# Job boards / ATS hosts are not the employer; never pick one as a company's logo domain
# (mirrors apps/web/lib/logoDomain.ts). Constants only -- safe to inline into the SQL.
_NON_EMPLOYER_LOGO_DOMAINS = ('linkedin.com', 'indeed.com', 'glassdoor.com', 'naukri.com', 'internshala.com', 'unstop.com', 'cutshort.in', 'freejobalert.com', 'remoteok.com', 'remoteok.io', 'weworkremotely.com', 'remotive.com', 'wayup.com', 'hiring.cafe', 'jobicy.com', 'arbeitnow.com', 'wellfound.com', 'angel.co', 'ycombinator.com', 'monster.com', 'ziprecruiter.com', 'simplyhired.com', 'foundit.in', 'shine.com', 'apna.co', 'greenhouse.io', 'lever.co', 'myworkdayjobs.com', 'workday.com', 'ashbyhq.com', 'smartrecruiters.com', 'icims.com', 'bamboohr.com', 'jobvite.com', 'breezy.hr', 'recruitee.com', 'workable.com', 'taleo.net', 'successfactors.com', 'oraclecloud.com', 'zohorecruit.com', 'darwinbox.in', 'keka.com', 'freshteam.com', 'pinpointhq.com', 'forms.gle', 'docs.google.com', 'typeform.com', 'bit.ly', 'tinyurl.com', 'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 't.me', 'whatsapp.com')
_NON_EMPLOYER_LOGO_RE = '(^|[.])(' + '|'.join(d.replace('.', '[.]') for d in _NON_EMPLOYER_LOGO_DOMAINS) + ')$'
MAX_PER_SECTION = 60

async def _company_entries(pool):
    """Live companies split into (top, mass_hire, startup) entry lists, unsorted."""
    freshness_sql = ' AND '.join(_freshness_conditions())
    rows = await pool.fetch(f"\n        SELECT\n            company,\n            count(*)                                   AS job_count,\n            bool_or(is_official_domain)                 AS is_official_domain,\n            (array_agg(apply_domain) FILTER (WHERE apply_domain IS NOT NULL))[1] AS apply_domain,\n            (array_agg(logo_domain ORDER BY is_official_domain DESC NULLS LAST, last_seen_at DESC NULLS LAST) FILTER (WHERE logo_domain IS NOT NULL AND logo_domain !~* '{_NON_EMPLOYER_LOGO_RE}'))[1]   AS logo_domain,\n            (array_agg(location) FILTER (WHERE location IS NOT NULL))[1]         AS sample_location,\n            max(posted_at)                              AS last_posted_at\n        FROM jobs\n        WHERE is_active = true AND {freshness_sql} AND company IS NOT NULL AND company != ''\n        GROUP BY company\n        ")
    # Earned set (static seed UNION data-driven "posts enough, legitimately" companies) --
    # see routes/jobs.py's _top_companies() docstring. Same pool call already cached
    # in-process, so this doesn't add a second DB round trip on a warm cache.
    top_companies = set(await _top_companies(pool))
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
    return top, mass_hire, startup


@router.get('/')
async def get_companies(limit_per_section: int=Query(default=MAX_PER_SECTION, ge=1, le=200)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    top, mass_hire, startup = await _company_entries(pool)
    top.sort(key=lambda c: c['company'].lower())
    mass_hire.sort(key=lambda c: c['job_count'], reverse=True)
    startup.sort(key=lambda c: (c['last_posted_at'] is not None, c['last_posted_at']), reverse=True)
    return {'top': {'companies': top[:limit_per_section], 'total': len(top)}, 'mass_hire': {'companies': mass_hire[:limit_per_section], 'total': len(mass_hire)}, 'startup': {'companies': startup[:limit_per_section], 'total': len(startup)}, 'mass_hire_threshold': MASS_HIRE_THRESHOLD}

MIN_PUBLISHED_TOPICS = 5   # keep in sync with services/company_intel topics.py and apps/web lib/seo/hubThresholds.ts


@router.get('/directory')
async def get_company_directory(letter: str | None = Query(default=None, max_length=5),
                                limit: int = Query(default=100, ge=1, le=200),
                                offset: int = Query(default=0, ge=0)):
    """Every company (live-job companies plus intel-only ones with enough published topics), by first letter.
    Without `letter` only the per-letter counts are returned. Gives every company a crawlable link path."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    top, mass_hire, startup = await _company_entries(pool)
    entries = {c['company'].lower(): c for c in (*top, *mass_hire, *startup)}
    intel_rows = await pool.fetch(
        """
        SELECT e.name, e.logo_domain, e.official_domain
        FROM company_entities e JOIN company_topics t ON t.entity_id = e.id AND t.status = 'published'
        WHERE e.status = 'active'
        GROUP BY e.id, e.name, e.logo_domain, e.official_domain HAVING count(*) >= $1
        """, MIN_PUBLISHED_TOPICS)
    for r in intel_rows:
        entries.setdefault(r['name'].lower(), {
            'company': r['name'], 'job_count': 0, 'is_official_domain': bool(r['official_domain']),
            'apply_domain': r['official_domain'], 'logo_domain': r['logo_domain'], 'sample_location': None,
            'last_posted_at': None, 'tier': 'startup'})
    counts: dict = {}
    for c in entries.values():
        k = directory_letter(c['company'])
        counts[k] = counts.get(k, 0) + 1
    order = [*'abcdefghijklmnopqrstuvwxyz', '0-9', 'other']
    letters = [{'letter': k, 'count': counts[k]} for k in order if k in counts]
    out = {'letters': letters, 'letter': None, 'total': 0, 'companies': []}
    if letter:
        key = letter.lower()
        picked = sorted((c for c in entries.values() if directory_letter(c['company']) == key),
                        key=lambda c: sort_key(c['company']))
        out.update(letter=key, total=len(picked), companies=picked[offset:offset + limit])
    return out


@router.get('/intel/sitemap')
async def get_intel_sitemap():
    """Slugs of companies with enough published topics to be indexable on their own (even with 0 live jobs)."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    rows = await pool.fetch(
        """
        SELECT e.slug, e.name, max(t.enriched_at) AS updated_at
        FROM company_entities e JOIN company_topics t ON t.entity_id = e.id AND t.status = 'published'
        WHERE e.status = 'active'
        GROUP BY e.slug, e.name HAVING count(*) >= $1
        ORDER BY e.slug
        """, MIN_PUBLISHED_TOPICS)
    return {'companies': [{'slug': r['slug'], 'name': r['name'], 'updated_at': r['updated_at']} for r in rows]}


@router.get('/by-slug/{slug}')
async def get_company_by_slug(slug: str):
    """Entity + published topics + live-job summary for one company. Declared before the
    /{company}/profile route so a company slugged 'profile' cannot shadow it."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    entity = await pool.fetchrow(
        'SELECT id, slug, name, official_domain, logo_domain, last_crawled_at FROM company_entities WHERE slug = $1 AND status = \'active\'', slug)
    if entity is None:
        raise HTTPException(404, 'Unknown company')
    topics = await pool.fetch(
        'SELECT topic_key, title, body, bullets, source_urls, enriched_at FROM company_topics '
        'WHERE entity_id = $1 AND status = \'published\' ORDER BY id', entity['id'])
    freshness_sql = ' AND '.join(_freshness_conditions())
    jobs = await pool.fetchrow(
        f"SELECT count(*) AS job_count, max(posted_at) AS last_posted_at FROM jobs "
        f"WHERE is_active = true AND {freshness_sql} AND lower(company) = lower($1)", entity['name'])
    out_topics = []
    for t in topics:
        d = dict(t)
        if isinstance(d.get('bullets'), str):  # asyncpg returns jsonb as text
            d['bullets'] = json.loads(d['bullets'])
        out_topics.append(d)
    return {'slug': entity['slug'], 'name': entity['name'], 'official_domain': entity['official_domain'],
            'logo_domain': entity['logo_domain'], 'last_crawled_at': entity['last_crawled_at'],
            'job_count': jobs['job_count'], 'last_posted_at': jobs['last_posted_at'], 'topics': out_topics}


@router.get('/{company}/profile')
async def get_company_profile(company: str):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow(
        'SELECT company, overview, keywords, facts, model, enriched_at FROM company_profiles WHERE lower(company) = lower($1)',
        company,
    )
    # A row with no overview means the company has too few facts for a profile.
    if row is None or not row['overview']:
        raise HTTPException(404, 'No profile for this company yet')
    out = dict(row)
    if isinstance(out.get('facts'), str):  # asyncpg returns jsonb as text
        out['facts'] = json.loads(out['facts'])
    return out

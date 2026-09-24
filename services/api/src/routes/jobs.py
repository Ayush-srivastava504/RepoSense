# Module: src/routes/jobs.py
# Defines function(s): _lower_top_companies, get_jobs, get_featured_jobs, get_similar_jobs, get_job
#
#

import asyncio
import re
from fastapi import APIRouter, HTTPException, Query
from configs.db import get_db_pool
router = APIRouter(prefix='/api/jobs', tags=['jobs'])
TOP_COMPANY_TIER = ['tcs', 'tata consultancy services', 'infosys', 'wipro', 'hcl', 'hcltech', 'cognizant', 'accenture', 'capgemini', 'tech mahindra', 'coforge', 'lti', 'ltimindtree', 'l&t infotech', 'mindtree', 'persistent systems', 'persistent', 'mphasis', 'zensar', 'zensar technologies', 'hexaware', 'hexaware technologies', 'cyient', 'niit technologies', 'niit', 'birlasoft', 'sonata software', 'happiest minds', 'tata elxsi', 'kpit', 'kpit technologies', 'virtusa', 'globant', 'publicis sapient', 'epam', 'epam systems', 'thoughtworks', 'newgen', 'newgen software', 'intellect design', 'firstsource', 'wns', 'wns global services', 'genpact', 'exl', 'exl service', 'concentrix', 'ttec', 'teleperformance', 'conduent', 'infosys bpm', 'tcs ion', 'quess corp', 'randstad', 'adecco', 'ibm', 'microsoft', 'google', 'alphabet', 'amazon', 'meta', 'facebook', 'apple', 'netflix', 'adobe', 'salesforce', 'oracle', 'sap', 'vmware', 'cisco', 'intel', 'nvidia', 'qualcomm', 'samsung', 'dell', 'hp', 'hewlett packard', 'lenovo', 'sony', 'lg', 'xiaomi', 'oneplus', 'ericsson', 'nokia', 'juniper networks', 'arista', 'f5', 'f5 networks', 'palo alto networks', 'crowdstrike', 'servicenow', 'workday', 'atlassian', 'slack', 'dropbox', 'snowflake', 'databricks', 'mongodb', 'confluent', 'elastic', 'twilio', 'stripe', 'paypal', 'square', 'block', 'uber', 'ola', 'ola cabs', 'swiggy', 'zomato', 'flipkart', 'myntra', 'paytm', 'phonepe', 'razorpay', 'cred', 'zepto', 'meesho', 'nykaa', 'policybazaar', 'freshworks', 'zoho', 'inmobi', 'browserstack', 'postman', 'chargebee', 'druva', 'mindtickle', 'cars24', 'urban company', 'dream11', 'groww', 'upstox', "byju's", 'byjus', 'unacademy', 'vedantu', 'upgrad', 'whitehat jr', 'physicswallah', 'lenskart', 'bigbasket', 'grofers', 'blinkit', 'dunzo', 'delhivery', 'shiprocket', 'sharechat', 'moj', 'dailyhunt', 'hike', 'gojek', 'deloitte', 'pwc', 'kpmg', 'ey', 'ernst & young', 'electronic arts', 'ea', 'mckinsey', 'mckinsey & company', 'bcg', 'boston consulting group', 'bain', 'bain & company', 'goldman sachs', 'jpmorgan', 'jp morgan', 'jpmorgan chase', 'morgan stanley', 'barclays', 'citi', 'citibank', 'citigroup', 'hsbc', 'deutsche bank', 'american express', 'amex', 'visa', 'mastercard', 'bank of america', 'ubs', 'nomura', 'wells fargo', 'standard chartered', 'credit suisse', 'state street', 'blackrock', 'fidelity', 'fidelity investments', 'd.e. shaw', 'de shaw', 'two sigma', 'optiver', 'citadel', 'jane street', 'reliance industries', 'reliance', 'jio', 'tata group', 'tata sons', 'mahindra', 'mahindra & mahindra', 'aditya birla group', 'aditya birla', 'bajaj', 'bajaj finserv', 'larsen & toubro', 'l&t', 'adani', 'adani group', 'itc', 'hindustan unilever', 'hul', 'asian paints', 'godrej', 'godrej group', 'maruti suzuki', 'tata motors', 'bosch', 'siemens', 'honeywell', 'ge', 'general electric', 'schneider electric', 'abb', 'airtel', 'bharti airtel', 'vodafone idea', 'vi', 'bsnl', 'juspay', 'cashfree', 'innovaccer', 'postman inc', 'yellow.ai', 'darwinbox', 'clevertap', 'hasura', 'rocketlane', 'zeta', 'amagi', 'gupshup', 'wingify', 'vwo', 'cure.fit', 'cult.fit', 'curefit', 'licious', 'rebel foods', 'eternal']
JOB_COLUMNS = '\n    id,\n    title,\n    company,\n    description,\n    url,\n    source,\n    posted_at,\n    created_at,\n    location,\n    salary,\n    stipend,\n    type,\n    deadline,\n    confidence_score,\n    confidence_label,\n    apply_domain,\n    logo_domain,\n    is_official_domain,\n    is_remote,\n    is_government,\n    country,\n    department,\n    vacancies,\n    notification_number,\n    job_group,\n    last_seen_at,\n    enriched_overview,\n    enriched_keywords,\n    allowed_degrees,\n    allowed_courses,\n    allowed_specializations,\n    allowed_passout_years,\n    required_skills,\n    notes_highlights,\n    work_mode,\n    experience_min,\n    experience_max,\n    job_function,\n    structured_description,\n    is_thin,\n    quality_score\n'
BADGE_EXPRESSIONS = "\n    (posted_at IS NOT NULL AND posted_at > now() - interval '24 hours') AS is_new,\n    (lower(company) = ANY(:top_companies)) AS is_top_company,\n    (confidence_score >= 90 AND is_official_domain) AS is_verified_source,\n    (\n        deadline IS NOT NULL\n        AND deadline > now()\n        AND deadline < now() + interval '2 days'\n    ) AS is_hot,\n    (\n        posted_at IS NOT NULL\n        AND posted_at < now() - interval '30 days'\n    ) AS is_stale\n"
RANKING_EXPRESSION = "\n    (\n        CASE WHEN lower(company) = ANY(:top_companies) THEN 40 ELSE 0 END\n        + CASE\n            WHEN posted_at > now() - interval '24 hours' THEN 35\n            WHEN posted_at > now() - interval '72 hours' THEN 20\n            WHEN posted_at > now() - interval '7 days' THEN 8\n            WHEN posted_at > now() - interval '30 days' THEN 0\n            ELSE -25\n          END\n        + (COALESCE(confidence_score, 0)::float / 100.0) * 25\n    )\n"

def _lower_top_companies() -> list[str]:
    return [c.lower() for c in TOP_COMPANY_TIER]

def _freshness_conditions() -> list[str]:
    """Belt-and-suspenders filter alongside is_active = true.

    is_active is supposed to get flipped to false by the crawler once a
    posting goes stale, but that only happens on crawl passes that
    actually run deactivate_stale_jobs()/check_liveness_for_aging_jobs()
    (see crawler/src/index.py). A crawl run that found zero new jobs
    (source outage, empty keyword pass, etc.) used to skip that cleanup
    entirely, so is_active = true rows could pile up for months. This
    adds an independent, query-time cutoff so listing/count/facet
    results stay sane even if a cleanup pass gets missed: exclude
    anything whose stated deadline has passed, or that's past its
    type-specific max age with no deadline signal at all — internships
    turn over much faster than full-time/other postings, so they get a
    tighter 10-day window vs. 20 days for everything else.
    """
    return [
        '(deadline IS NULL OR deadline > now())',
        """(
            posted_at IS NULL
            OR (type = 'internship' AND posted_at > now() - interval '10 days')
            OR (type <> 'internship' AND posted_at > now() - interval '20 days')
        )""",
    ]

# Phase 2 pagination follow-up (PHASE_PLAN.md item 2's leftover note):
# mirrors apps/web/lib/jobPriority.ts's bucket()/isIndiaJob()/sortIndiaFirst()
# exactly, so the same "India first, then remote, then Japan, then other"
# grouping (and the "India" filter itself) can be pushed into SQL instead of
# being computed by slicing a fetched, limit-bounded array client-side.
# country is treated as India whenever it's NULL/blank, matching the JS
# version's `!country || country === 'india'` check.
_INDIA_BUCKET_SQL = """(
    CASE
        WHEN country IS NULL OR trim(country) = '' OR lower(trim(country)) = 'india' THEN 0
        WHEN is_remote THEN 1
        WHEN lower(trim(country)) = 'japan' THEN 2
        ELSE 3
    END
)"""
_INDIA_ONLY_CONDITION = "(country IS NULL OR trim(country) = '' OR lower(trim(country)) = 'india')"

# --- Phase 2: backend facets endpoint + server-side multi-select filters ---
# See PHASE_PLAN.md items 1-2. Mirrors apps/web/lib/facets.ts's
# slugifyFacet() exactly (lower -> collapse non-alnum runs to '-' -> trim
# leading/trailing '-') so a slug computed here always matches a slug
# computed there — the frontend sends these slugs back as ?skills=...
# query values, and expects them to line up 1:1 with FacetOption.value.
def _slug_sql(expr: str) -> str:
    return f"regexp_replace(regexp_replace(lower(trim({expr})), '[^a-z0-9]+', '-', 'g'), '(^-|-$)', '')"

# Mirrors lib/facets.ts's SOURCE_LABELS. Kept in sync manually since one
# lives in the Next.js layer and one here; both are small, human-curated
# display-name tables.
SOURCE_LABELS = {
    'greenhouse': 'Greenhouse', 'lever': 'Lever', 'ashby': 'Ashby',
    'smartrecruiters': 'SmartRecruiters', 'workable': 'Workable',
    'recruitee': 'Recruitee', 'teamtailor': 'Teamtailor', 'bamboohr': 'BambooHR',
    'breezyhr': 'Breezy HR', 'personio': 'Personio', 'freshteam': 'Freshteam',
    'naukri': 'Naukri', 'internshala': 'Internshala', 'linkedin': 'LinkedIn',
    'hiringcafe': 'Hiring Cafe', 'unstop': 'Unstop', 'cutshort': 'Cutshort',
    'company_portals': 'Company Careers', 'remoteok': 'RemoteOK',
    'weworkremotely': 'We Work Remotely', 'remotive': 'Remotive',
    'employment_news': 'Employment News', 'freejobalert': 'FreeJobAlert',
    'dorker': 'Web Discovery', 'generic_boards': 'Job Boards',
}

def _source_label(raw: str) -> str:
    key = raw.lower().strip()
    if key in SOURCE_LABELS:
        return SOURCE_LABELS[key]
    return re.sub(r'\b\w', lambda m: m.group(0).upper(), re.sub(r'[_-]+', ' ', raw))

def _parse_multi(value: str | None) -> list[str]:
    if not value:
        return []
    seen: dict[str, None] = {}
    for part in value.split(','):
        part = part.strip()
        if part:
            seen[part] = None
    return list(seen.keys())

FACET_MAX_OPTIONS = 60

def _build_facet_scope_conditions(params: list, *, search: str | None, type: str | None, category: str | None, job_group: str | None, country: str | None, work_mode: str | None) -> list[str]:
    """Same scoping semantics as get_jobs's search/type/category/job_group/
    country/work_mode conditions, deliberately NOT including
    skill/course/source/batch/company — those are exactly the filters the
    facets endpoint computes options FOR, so applying them here would
    make each dropdown shrink its own option list down to just the
    already-selected value (see jobs/page.tsx's comment on this)."""
    conditions = ['is_active = true', *_freshness_conditions()]
    if type:
        params.append(type)
        conditions.append(f'type = ${len(params)}')
    if category == 'remote':
        conditions.append('is_remote = true')
    elif category == 'government':
        conditions.append('is_government = true')
    if job_group:
        params.append(job_group)
        conditions.append(f'job_group = ${len(params)}')
    if country:
        params.append(country)
        conditions.append(f'lower(country) = lower(${len(params)})')
    if work_mode:
        params.append(work_mode)
        conditions.append(f'work_mode = ${len(params)}')
    if search:
        params.append(f'%{search}%')
        n = len(params)
        conditions.append(f'(title ILIKE ${n} OR company ILIKE ${n} OR description ILIKE ${n})')
    return conditions

async def _array_facet_counts(pool, where: str, params: list, array_expr: str) -> list[dict]:
    """Aggregates an array column (e.g. allowed_courses) into
    {value, label, count}, one row per distinct (job, slug) pair so a job
    listing two variants of the same skill only counts once — matching
    lib/facets.ts's `seenOnThisJob` dedupe."""
    slug = _slug_sql('val')
    sql = f"""
        WITH expanded AS (
            SELECT id, posted_at, val
            FROM jobs, unnest(coalesce({array_expr}, '{{}}')) AS val
            WHERE {where} AND val IS NOT NULL AND trim(val) <> ''
        ),
        keyed AS (
            SELECT DISTINCT ON (id, {slug}) id, posted_at, {slug} AS key, val
            FROM expanded
            ORDER BY id, {slug}, val
        )
        SELECT key AS value, (array_agg(val ORDER BY posted_at DESC NULLS LAST))[1] AS label, COUNT(*) AS count
        FROM keyed
        WHERE key <> ''
        GROUP BY key
        ORDER BY count DESC, label ASC
        LIMIT {FACET_MAX_OPTIONS}
    """
    rows = await pool.fetch(sql, *params)
    return [dict(row) for row in rows]

async def _scalar_facet_counts(pool, where: str, params: list, column: str) -> list[dict]:
    slug = _slug_sql('val')
    sql = f"""
        WITH base AS (
            SELECT id, posted_at, {column} AS val
            FROM jobs
            WHERE {where} AND {column} IS NOT NULL AND trim({column}) <> ''
        )
        SELECT {slug} AS value, (array_agg(val ORDER BY posted_at DESC NULLS LAST))[1] AS label, COUNT(*) AS count
        FROM base
        GROUP BY {slug}
        HAVING {slug} <> ''
        ORDER BY count DESC, label ASC
        LIMIT {FACET_MAX_OPTIONS}
    """
    rows = await pool.fetch(sql, *params)
    return [dict(row) for row in rows]

async def _batch_facet_counts(pool, where: str, params: list) -> list[dict]:
    sql = f"""
        WITH expanded AS (
            SELECT id, y::text AS val
            FROM jobs, unnest(coalesce(allowed_passout_years, '{{}}')) AS y
            WHERE {where}
        ),
        deduped AS (
            SELECT DISTINCT id, val FROM expanded
        )
        SELECT val AS value, val AS label, COUNT(*) AS count
        FROM deduped
        GROUP BY val
        ORDER BY val DESC
        LIMIT {FACET_MAX_OPTIONS}
    """
    rows = await pool.fetch(sql, *params)
    return [dict(row) for row in rows]

@router.get('/')
async def get_jobs(limit: int=Query(default=200, ge=1, le=500), offset: int=Query(default=0, ge=0), source: str | None=Query(default=None), search: str | None=Query(default=None), type: str | None=Query(default=None, description="Filter by job type, e.g. 'internship'"), category: str | None=Query(default=None, pattern='^(remote|government)$', description="'remote' for is_remote=true, 'government' for is_government=true"), job_group: str | None=Query(default=None, pattern='^(software|sales|finance|other)$', description='Coarse role filter: software | sales | finance | other'), country: str | None=Query(default=None, description="Filter by country, e.g. 'Japan'. Case-insensitive exact match."), company: str | None=Query(default=None, description='Filter by company name. Case-insensitive exact match, used by /companies/[slug] hub pages.'), skill: str | None=Query(default=None, description='Filter by skill/technology. Matches the structured required_skills array first (exact, case-insensitive), then enriched_keywords, then falls back to title/description — used by /skills/[slug] hub pages.'), work_mode: str | None=Query(default=None, pattern='^(ONSITE|REMOTE|HYBRID)$', description='Filter by extracted work mode: ONSITE | REMOTE | HYBRID.'), course: str | None=Query(default=None, description='Filter by allowed course/degree, e.g. "B.Tech" or "Diploma". Matches allowed_courses array, case-insensitive.'), sort: str=Query(default='recent', pattern='^(recent|ranked)$', description="'recent' (default, unchanged) or 'ranked' for the boosted first-page ordering"), skills: str | None=Query(default=None, description='Phase 2 multi-select (PHASE_PLAN.md item 2): comma-separated skill slugs from GET /api/jobs/facets, e.g. "react-js,python". ANDed with the other filters; a job matches if it has ANY of the listed skills.'), courses: str | None=Query(default=None, description='Phase 2 multi-select: comma-separated course slugs from the facets endpoint.'), sources: str | None=Query(default=None, description='Phase 2 multi-select: comma-separated source slugs from the facets endpoint.'), batches: str | None=Query(default=None, description='Phase 2 multi-select: comma-separated passout-year strings, e.g. "2026,2027".'), companies: str | None=Query(default=None, description='Phase 2 multi-select: comma-separated company slugs from the facets endpoint.'), india_only: bool=Query(default=False, description='Phase 2 pagination follow-up: server-side equivalent of the frontend\'s isIndiaJob() filter (country is null/blank/India). Lets /jobs and /internships paginate the "India" location filter with real LIMIT/OFFSET instead of over-fetching and filtering client-side.'), india_first: bool=Query(default=False, description='Phase 2 pagination follow-up: server-side equivalent of the frontend\'s sortIndiaFirst() — orders India/blank-country rows first, then remote, then Japan, then everything else, before the existing sort/ranked ordering as a tiebreaker within each group.')):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    conditions = ['is_active = true', *_freshness_conditions()]
    params: list = []
    if source:
        params.append(source)
        conditions.append(f'source = ${len(params)}')
    if type:
        params.append(type)
        conditions.append(f'type = ${len(params)}')
    if category == 'remote':
        conditions.append('is_remote = true')
    elif category == 'government':
        conditions.append('is_government = true')
    if job_group:
        params.append(job_group)
        conditions.append(f'job_group = ${len(params)}')
    if country:
        params.append(country)
        conditions.append(f'lower(country) = lower(${len(params)})')
    if company:
        params.append(company)
        conditions.append(f'lower(company) = lower(${len(params)})')
    if skill:
        params.append(skill)
        n = len(params)
        # required_skills (structured_enrichment.py) is the higher-signal field —
        # checked first so an exact structured match always wins — then the
        # older enriched_keywords list, then a raw text fallback for jobs that
        # haven't been through either enrichment pass yet.
        conditions.append(f"""(
            EXISTS (SELECT 1 FROM unnest(coalesce(required_skills, '{{}}')) k WHERE k ILIKE ${n})
            OR EXISTS (SELECT 1 FROM unnest(coalesce(enriched_keywords, '{{}}')) k WHERE k ILIKE ${n})
            OR title ILIKE '%' || ${n} || '%'
            OR description ILIKE '%' || ${n} || '%'
        )""")
    if work_mode:
        params.append(work_mode)
        conditions.append(f'work_mode = ${len(params)}')
    if course:
        params.append(course)
        n = len(params)
        conditions.append(f"EXISTS (SELECT 1 FROM unnest(coalesce(allowed_courses, '{{}}')) c WHERE c ILIKE ${n})")
    if search:
        params.append(f'%{search}%')
        n = len(params)
        conditions.append(f'(title ILIKE ${n} OR company ILIKE ${n} OR description ILIKE ${n})')
    # Phase 2 (PHASE_PLAN.md item 2): the AdvancedJobFilters.tsx multi-select
    # bar. Values are pre-slugified by the frontend (facets endpoint hands
    # out {value: <slug>, ...} options, and the filter bar echoes `value`
    # straight back as the query param) — apply the identical slug
    # expression here so a row matches iff its facets.ts-computed slug
    # would have matched. Each behaves as an OR-of-selections, ANDed with
    # every other filter, mirroring applyAdvancedFilters()'s matchesAny().
    skills_list = _parse_multi(skills)
    if skills_list:
        params.append(skills_list)
        n = len(params)
        skills_slug = _slug_sql('k')
        conditions.append(f"""EXISTS (
            SELECT 1 FROM unnest(coalesce(
                CASE WHEN required_skills IS NOT NULL THEN required_skills ELSE enriched_keywords END,
                '{{}}'
            )) k
            WHERE {skills_slug} = ANY(${n})
        )""")
    courses_list = _parse_multi(courses)
    if courses_list:
        params.append(courses_list)
        n = len(params)
        courses_slug = _slug_sql('c')
        conditions.append(f"EXISTS (SELECT 1 FROM unnest(coalesce(allowed_courses, '{{}}')) c WHERE {courses_slug} = ANY(${n}))")
    sources_list = _parse_multi(sources)
    if sources_list:
        params.append(sources_list)
        n = len(params)
        conditions.append(f'{_slug_sql("source")} = ANY(${n})')
    companies_list = _parse_multi(companies)
    if companies_list:
        params.append(companies_list)
        n = len(params)
        conditions.append(f'{_slug_sql("company")} = ANY(${n})')
    batches_list = _parse_multi(batches)
    if batches_list:
        params.append(batches_list)
        n = len(params)
        conditions.append(f"EXISTS (SELECT 1 FROM unnest(coalesce(allowed_passout_years, '{{}}')) y WHERE y::text = ANY(${n}))")
    if india_only:
        conditions.append(_INDIA_ONLY_CONDITION)
    where = 'WHERE ' + ' AND '.join(conditions)
    total: int = await pool.fetchval(f'SELECT COUNT(*) FROM jobs {where}', *params)
    top_companies_pos = len(params) + 1
    params_with_companies = params + [_lower_top_companies()]
    limit_pos = len(params_with_companies) + 1
    offset_pos = len(params_with_companies) + 2
    placeholder = f'${top_companies_pos}'
    # Deterministic ordering is REQUIRED for LIMIT/OFFSET pagination: many rows
    # share the same posted_at (and ~10k have it NULL). Without a unique
    # tie-breaker Postgres may return the same row on two pages and skip
    # others, which produced ~250 duplicate URLs in sitemap-jobs.xml. `id`
    # is unique. NULLS LAST also stops undated jobs floating to the top
    # (Postgres sorts NULLs FIRST for DESC by default).
    order_by = 'posted_at DESC NULLS LAST, id DESC'
    if sort == 'ranked':
        ranking_sql = RANKING_EXPRESSION.replace(':top_companies', placeholder)
        order_by = f'{ranking_sql} DESC, posted_at DESC NULLS LAST, id DESC'
    if india_first:
        order_by = f'{_INDIA_BUCKET_SQL} ASC, {order_by}'
    badges_sql = BADGE_EXPRESSIONS.replace(':top_companies', placeholder)
    rows = await pool.fetch(f'\n        SELECT\n            {JOB_COLUMNS},\n            {badges_sql}\n        FROM jobs\n        {where}\n        ORDER BY {order_by}\n        LIMIT ${limit_pos} OFFSET ${offset_pos}\n        ', *params_with_companies, limit, offset)
    return {'jobs': [dict(row) for row in rows], 'total': total, 'limit': limit, 'offset': offset}

@router.get('/featured')
async def get_featured_jobs(limit: int=Query(default=6, ge=1, le=12), type: str | None=Query(default=None), category: str | None=Query(default=None, pattern='^(remote|government)$', description="'remote' for is_remote=true, 'government' for is_government=true"), job_group: str | None=Query(default=None, pattern='^(software|sales|finance|other)$'), country: str | None=Query(default=None)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    conditions = ['is_active = true', "posted_at > now() - interval '14 days'", '(lower(company) = ANY($1) OR confidence_score >= 80)']
    params: list = [_lower_top_companies()]
    if type:
        params.append(type)
        conditions.append(f'type = ${len(params)}')
    if category == 'remote':
        conditions.append('is_remote = true')
    elif category == 'government':
        conditions.append('is_government = true')
    if job_group:
        params.append(job_group)
        conditions.append(f'job_group = ${len(params)}')
    if country:
        params.append(country)
        conditions.append(f'lower(country) = lower(${len(params)})')
    where = 'WHERE ' + ' AND '.join(conditions)
    placeholder = '$1'
    ranking_sql = RANKING_EXPRESSION.replace(':top_companies', placeholder)
    badges_sql = BADGE_EXPRESSIONS.replace(':top_companies', placeholder)
    limit_pos = len(params) + 1
    rows = await pool.fetch(f'\n        SELECT\n            {JOB_COLUMNS},\n            {badges_sql}\n        FROM jobs\n        {where}\n        ORDER BY {ranking_sql} DESC, posted_at DESC\n        LIMIT ${limit_pos}\n        ', *params, limit)
    return {'jobs': [dict(row) for row in rows]}
@router.get('/facets')
async def get_jobs_facets(search: str | None=Query(default=None), type: str | None=Query(default=None), category: str | None=Query(default=None, pattern='^(remote|government)$'), job_group: str | None=Query(default=None, pattern='^(software|sales|finance|other)$'), country: str | None=Query(default=None), work_mode: str | None=Query(default=None, pattern='^(ONSITE|REMOTE|HYBRID)$')):
    """Phase 2 (PHASE_PLAN.md item 1): computes Skills/Course/Source/Batch/
    Company option counts against the FULL active-jobs table, scoped by
    the same location+role+mode+search params the list endpoint takes —
    not bounded by any page `limit`. Response shape matches
    apps/web/lib/facets.ts's FacetSnapshot exactly so the call site swap
    in jobs/page.tsx / internships/page.tsx didn't need to touch
    AdvancedJobFilters.tsx at all."""
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    params: list = []
    conditions = _build_facet_scope_conditions(params, search=search, type=type, category=category, job_group=job_group, country=country, work_mode=work_mode)
    where = ' AND '.join(conditions)
    skills_arr_expr = "CASE WHEN required_skills IS NOT NULL THEN required_skills ELSE enriched_keywords END"
    skills, courses, sources, batches, companies = await asyncio.gather(
        _array_facet_counts(pool, where, list(params), skills_arr_expr),
        _array_facet_counts(pool, where, list(params), 'allowed_courses'),
        _scalar_facet_counts(pool, where, list(params), 'source'),
        _batch_facet_counts(pool, where, list(params)),
        _scalar_facet_counts(pool, where, list(params), 'company'),
    )
    for row in sources:
        row['label'] = _source_label(row['label'])
    return {
        'skills': skills,
        'courses': courses,
        'sources': sources,
        'batches': batches,
        'companies': companies,
    }

SIMILAR_JOBS_EXPRESSION = "\n    similarity(title, :self_title) * 50\n    + CASE WHEN job_group = :self_job_group THEN 20 ELSE 0 END\n    + CASE WHEN type = :self_type THEN 15 ELSE 0 END\n    + CASE WHEN is_remote = :self_is_remote THEN 8 ELSE 0 END\n    + CASE\n        WHEN :self_location != '' AND lower(location) = lower(:self_location)\n        THEN 10 ELSE 0\n      END\n    + CASE\n        WHEN posted_at > now() - interval '7 days' THEN 5\n        WHEN posted_at > now() - interval '30 days' THEN 2\n        ELSE 0\n      END\n"

@router.get('/{job_id}/similar')
async def get_similar_jobs(job_id: str, limit: int=Query(default=6, ge=1, le=12)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    self_job = await pool.fetchrow('\n        SELECT title, job_group, type, is_remote, location, company\n        FROM jobs\n        WHERE id = $1\n        ', job_id)
    if self_job is None:
        raise HTTPException(404, 'Job not found')
    placeholder = '$6'
    badges_sql = BADGE_EXPRESSIONS.replace(':top_companies', placeholder)
    ranking_sql = SIMILAR_JOBS_EXPRESSION.replace(':self_title', '$2').replace(':self_job_group', '$3').replace(':self_type', '$4').replace(':self_is_remote', '$5').replace(':self_location', '$7')
    freshness_sql = ' AND '.join(_freshness_conditions())
    rows = await pool.fetch(f'\n        SELECT\n            {JOB_COLUMNS},\n            {badges_sql},\n            ({ranking_sql}) AS match_score\n        FROM jobs\n        WHERE is_active = true\n          AND {freshness_sql}\n          AND id != $1\n          AND (\n              job_group = $3\n              OR type = $4\n              OR similarity(title, $2) > 0.15\n          )\n        ORDER BY match_score DESC, posted_at DESC\n        LIMIT $8\n        ', job_id, self_job['title'] or '', self_job['job_group'] or 'other', self_job['type'] or '', self_job['is_remote'] or False, _lower_top_companies(), self_job['location'] or '', limit)
    return {'jobs': [dict(row) for row in rows]}

@router.get('/{job_id}/status')
async def get_job_status(job_id: str):
    """Tell "expired" apart from "never existed" for the web tier.

    GET /api/jobs/{id} returns 404 for both, because it filters on
    is_active = true. The web middleware calls this to answer 410 Gone for a
    row the crawler deactivated (Google drops 410s faster than 404s) while
    leaving genuinely unknown IDs as a normal 404.
    Returns {"state": "active" | "gone"}; 404 when the ID was never stored.
    """
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    row = await pool.fetchrow('SELECT is_active FROM jobs WHERE id = $1', job_id)
    if row is None:
        raise HTTPException(404, 'Job not found')
    return {'state': 'active' if row['is_active'] else 'gone'}

GONE_IDS_MAX_DAYS = 30  # kept only as the upper bound a caller may still ask for
GONE_IDS_MAX_ROWS = 20000

@router.get('/gone-ids')
async def get_gone_ids(since_days: int | None = Query(default=None, ge=1, le=GONE_IDS_MAX_DAYS)):
    """Bulk companion to GET /{job_id}/status for the web middleware's 410 check.

    Per-ID lookups don't amortize well across Vercel's ephemeral serverless/edge
    instances -- each cold instance calls /status again for every job it happens
    to serve. This returns deactivated job ids so one instance can refresh a
    single shared set on a timer instead of one request per unique job ID.
    Fails the same way /status does: no special auth beyond the existing
    rate-limit bypass (X-Internal-Key).

    since_days omitted (the default, and what the web middleware uses) ->
    unbounded by time, newest-deactivated first, capped by GONE_IDS_MAX_ROWS.
    Previously this was hard-capped at 30 days: a job deactivated 31+ days
    ago dropped out of the set, the middleware stopped answering 410 for it,
    and the page fell through to a plain notFound() 404 instead -- Google
    treats a 410 as a much stronger "this is permanently gone" signal than a
    404 and drops it from the index faster, so that regression was actively
    working against deindexing old listings. GONE_IDS_MAX_ROWS still bounds
    the payload; a caller can still pass since_days for a narrower window.
    """
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    if since_days is None:
        rows = await pool.fetch(
            '''
            SELECT id FROM jobs
            WHERE is_active = false
            ORDER BY last_seen_at DESC
            LIMIT $1
            ''',
            GONE_IDS_MAX_ROWS,
        )
    else:
        rows = await pool.fetch(
            '''
            SELECT id FROM jobs
            WHERE is_active = false
              AND last_seen_at > now() - ($1 || ' days')::interval
            ORDER BY last_seen_at DESC
            LIMIT $2
            ''',
            since_days, GONE_IDS_MAX_ROWS,
        )
    return {'ids': [row['id'] for row in rows]}

@router.get('/{job_id}')
async def get_job(job_id: str, locale: str | None = Query(default=None)):
    pool = await get_db_pool()
    if pool is None:
        raise HTTPException(503, 'Database unavailable')
    placeholder = '$2'
    badges_sql = BADGE_EXPRESSIONS.replace(':top_companies', placeholder)
    row = await pool.fetchrow(f'\n        SELECT\n            {JOB_COLUMNS},\n            {badges_sql}\n        FROM jobs\n        WHERE id = $1 AND is_active = true\n        ', job_id, _lower_top_companies())
    if row is None:
        raise HTTPException(404, 'Job not found')
    job = dict(row)
    # Every locale this job actually has translated content for — sent
    # regardless of the `locale` param so the frontend can build job-aware
    # hreflang (lib/hreflang.ts's jobHreflangLinks()) without a second call,
    # and so a locale with no row falls back to English rather than
    # advertising a URL that's really just English content again.
    translation_rows = await pool.fetch('SELECT locale FROM job_translations WHERE job_id = $1', job_id)
    translated_locales = [r['locale'] for r in translation_rows]
    job['translated_locales'] = translated_locales
    if locale and locale in translated_locales:
        t = await pool.fetchrow(
            'SELECT title, overview, structured_description FROM job_translations WHERE job_id = $1 AND locale = $2',
            job_id, locale,
        )
        if t is not None:
            job['title'] = t['title']
            if t['overview']:
                job['enriched_overview'] = t['overview']
            if t['structured_description']:
                job['structured_description'] = t['structured_description']
            job['content_locale'] = locale
    return job

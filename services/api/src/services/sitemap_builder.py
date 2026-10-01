# Module: services/sitemap_builder.py
# Builds the category job sitemaps directly from the DB and stores them in
# sitemap_cache (migration 028). Python port of the rules in
# apps/web/lib/sitemapJobs.ts (isJobForSitemap), lib/seo/seoMetrics.ts
# (isIndexableJob) and lib/slug.ts. Keep them in sync; tests/test_sitemap_builder.py
# pins the behaviour.
#
# Why this exists: the web tier used to page through /api/jobs (500 rows x ~28
# calls) on every sitemap request. That endpoint applies _freshness_conditions()
# (10/20-day windows), so anything older never appeared -- the tiered 31-90 day
# rule could not work -- and any 429 or a `total` that drifted mid-fetch threw
# IncompleteSitemapError -> 503. Reading the table directly removes both.

import os
import re
from datetime import datetime, timezone
from typing import Iterable, Optional

SITE_URL = (os.getenv('SITE_URL') or os.getenv('NEXT_PUBLIC_SITE_URL') or 'https://intern-flow.in').rstrip('/')
if SITE_URL.split('//', 1)[-1].startswith('www.'):
    SITE_URL = 'https://intern-flow.in'

CATEGORIES = ('jobs', 'internships', 'remote-jobs', 'government-jobs')
URLS_PER_FILE = 1000
TIER_FRESH_DAYS = 30
TIER_MID_DAYS = 90
TIER_MID_MIN_QUALITY = 50
TIER_OLD_MIN_QUALITY = 75
STALE_GRACE_DAYS = 45
# Refuse to replace a healthy cache with something far smaller (bad deploy,
# half-restored DB, enrichment table wiped). Override with --force.
MIN_KEEP_RATIO = 0.5

JOB_SQL = '''
SELECT id, title, company, location, salary, stipend, type, is_remote, is_government,
       deadline, posted_at, created_at, last_seen_at, is_thin, quality_score,
       (enriched_overview IS NOT NULL AND enriched_overview <> '') AS has_overview
FROM jobs
WHERE is_active = true
ORDER BY id
'''


def slugify(value: str) -> str:
    return re.sub(r'(^-|-$)', '', re.sub(r'[^a-z0-9]+', '-', (value or '').lower()))


def job_slug(job: dict) -> str:
    parts = [slugify(job.get('title')), slugify(job.get('company'))]
    location = job.get('location') or ''
    city = location.split(',')[0].strip()
    if city:
        parts.append(slugify(city))
    pay = job.get('salary') or job.get('stipend')
    if pay:
        parts.append(slugify(pay))
    base = '-'.join(p for p in parts if p)
    if len(base) > 90:
        base = base[:90].rstrip('-')
    return f"{base}-{job['id']}"


def category_for_job(job: dict) -> str:
    if job.get('is_government'):
        return 'government-jobs'
    if job.get('type') == 'internship':
        return 'internships'
    if job.get('is_remote'):
        return 'remote-jobs'
    return 'jobs'


def canonical_path(job: dict) -> str:
    return f"/{category_for_job(job)}/{job_slug(job)}"


def _aware(dt: Optional[datetime]) -> Optional[datetime]:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_stale_for_indexing(job: dict, now: datetime) -> bool:
    deadline, posted = _aware(job.get('deadline')), _aware(job.get('posted_at'))
    if deadline is not None:
        expiry = deadline
    elif posted is not None:
        expiry = posted.timestamp() + STALE_GRACE_DAYS * 86400
        return expiry < now.timestamp()
    else:
        return False
    return expiry < now


def is_indexable(job: dict, now: datetime) -> bool:
    if is_stale_for_indexing(job, now):
        return False
    return not (job.get('is_thin') is True and not job.get('has_overview'))


def is_job_for_sitemap(job: dict, now: datetime) -> bool:
    if not is_indexable(job, now) or not job.get('has_overview'):
        return False
    ref = _aware(job.get('posted_at')) or _aware(job.get('last_seen_at'))
    if ref is None:
        return False
    age_days = (now - ref).total_seconds() / 86400
    if age_days < 0:
        return False
    if age_days <= TIER_FRESH_DAYS:
        return True
    quality = job.get('quality_score') or 0
    if age_days <= TIER_MID_DAYS:
        return quality >= TIER_MID_MIN_QUALITY
    return quality >= TIER_OLD_MIN_QUALITY


def to_lastmod(value: Optional[datetime], now: datetime) -> Optional[str]:
    value = _aware(value)
    if value is None or value > now:
        return None
    return value.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S.') + f'{value.microsecond // 1000:03d}Z'


def escape_xml(value: str) -> str:
    return (value.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
            .replace('"', '&quot;').replace("'", '&apos;'))


def build_urlset(entries: list) -> str:
    body = []
    for loc, lastmod in entries:
        parts = [f'    <loc>{escape_xml(loc)}</loc>']
        if lastmod:
            parts.append(f'    <lastmod>{lastmod}</lastmod>')
        body.append('  <url>\n' + '\n'.join(parts) + '\n  </url>')
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + '\n'.join(body) + '\n</urlset>')


def build_files(jobs: Iterable[dict], now: Optional[datetime] = None) -> dict:
    """-> {file_name: (category, page, url_count, xml)}"""
    now = now or datetime.now(timezone.utc)
    buckets = {c: [] for c in CATEGORIES}
    seen = set()
    for job in jobs:
        jid = job.get('id')
        if not jid or jid in seen:
            continue
        seen.add(jid)
        if not is_job_for_sitemap(job, now):
            continue
        buckets[category_for_job(job)].append(
            (f'{SITE_URL}{canonical_path(job)}', to_lastmod(job.get('posted_at') or job.get('created_at'), now)))
    files = {}
    for category, entries in buckets.items():
        # newest first so page 1 holds the freshest URLs
        entries.sort(key=lambda e: e[1] or '', reverse=True)
        for i in range(0, len(entries), URLS_PER_FILE):
            chunk = entries[i:i + URLS_PER_FILE]
            page = i // URLS_PER_FILE + 1
            files[f'{category}-{page}.xml'] = (category, page, len(chunk), build_urlset(chunk))
    return files


async def rebuild(pool, force: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    rows = [dict(r) for r in await pool.fetch(JOB_SQL)]
    files = build_files(rows, now)
    new_total = sum(f[2] for f in files.values())
    old_total = await pool.fetchval('SELECT COALESCE(SUM(url_count), 0) FROM sitemap_cache') or 0
    if not force and old_total > 0 and new_total < old_total * MIN_KEEP_RATIO:
        raise RuntimeError(f'refusing to shrink sitemap cache {old_total} -> {new_total} URLs (use --force)')
    if new_total == 0:
        raise RuntimeError('built 0 URLs; refusing to overwrite cache')
    async with pool.acquire() as conn:
        async with conn.transaction():
            for name, (category, page, count, xml) in files.items():
                await conn.execute(
                    '''INSERT INTO sitemap_cache (file_name, category, page, url_count, xml, built_at)
                       VALUES ($1,$2,$3,$4,$5,now())
                       ON CONFLICT (file_name) DO UPDATE SET category=EXCLUDED.category, page=EXCLUDED.page,
                         url_count=EXCLUDED.url_count, xml=EXCLUDED.xml, built_at=EXCLUDED.built_at''',
                    name, category, page, count, xml)
            await conn.execute('DELETE FROM sitemap_cache WHERE NOT (file_name = ANY($1::text[]))', list(files))
    per_cat = {c: sum(f[2] for f in files.values() if f[0] == c) for c in CATEGORIES}
    return {'jobs_scanned': len(rows), 'urls': new_total, 'files': len(files), 'per_category': per_cat}

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

import asyncio
import os
import re
import time
from datetime import datetime, timezone
from typing import Iterable, Optional

SITE_URL = (os.getenv('SITE_URL') or os.getenv('NEXT_PUBLIC_SITE_URL') or 'https://intern-flow.in').rstrip('/')
if SITE_URL.split('//', 1)[-1].startswith('www.'):
    SITE_URL = 'https://intern-flow.in'

CATEGORIES = ('jobs', 'internships', 'remote-jobs', 'government-jobs')
# slug <-> job_rule. The slug is also the URL prefix on the site, so it is fixed by the web
# routes; the sitemap_categories table (migration 030) decides which of these are ENABLED.
RULE_SLUGS = {'government': 'government-jobs', 'internship': 'internships', 'remote': 'remote-jobs', 'default': 'jobs'}
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


def build_files(jobs: Iterable[dict], now: Optional[datetime] = None, enabled: Optional[Iterable[str]] = None) -> dict:
    """-> {file_name: (category, page, url_count, xml)}
    `enabled` = job-category slugs allowed by the sitemap_categories registry (None = all)."""
    now = now or datetime.now(timezone.utc)
    allowed = set(CATEGORIES if enabled is None else enabled)
    buckets = {c: [] for c in CATEGORIES if c in allowed}
    seen = set()
    for job in jobs:
        jid = job.get('id')
        if not jid or jid in seen:
            continue
        seen.add(jid)
        category = category_for_job(job)
        if category not in buckets or not is_job_for_sitemap(job, now):
            continue
        buckets[category].append(
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


REGISTRY_SQL = 'SELECT slug, kind, job_rule, path, enabled, sort_order FROM sitemap_categories ORDER BY sort_order, slug'


async def load_registry(pool) -> list:
    """Registry rows as dicts. Falls back to all-job-categories-enabled (the pre-registry
    behaviour) when the table is missing/empty/unreadable, so a build never fails on it."""
    try:
        rows = [dict(r) for r in await pool.fetch(REGISTRY_SQL)]
    except Exception:
        rows = []
    return rows


def enabled_job_categories(registry: list) -> list:
    if not registry:
        return list(CATEGORIES)
    return [r['slug'] for r in registry if r['kind'] == 'job_cache' and r['enabled'] and r['slug'] in CATEGORIES]


# Only one rebuild may run at a time. build-sitemaps.yml (hourly) and daily-pipeline.yml's
# sitemap stage run the same script, and can overlap whenever enrichment overruns into :17.
# Each rebuild is one transaction, so a reader never sees a half-written cache; what overlap
# does cost is double work, and an edge case where the slower DELETE removes or keeps rows
# based on a stale file list. A Postgres advisory lock serialises every caller (workflows,
# manual runs, anything else) because they all share this database.
#
# Waiting (not skipping) is deliberate: the pipeline's sitemap stage must build AFTER
# enrichment, so if an hourly build is mid-flight it should queue behind it and then run,
# not be told "someone else is building" and push stale URLs to the indexers.
#
# The lock is session-level and lives on one dedicated connection, so it is released
# automatically if the process dies. Postgres must be reached directly (not through a
# transaction-mode pooler such as PgBouncer), which is how the EC2 box is set up.
SITEMAP_LOCK_KEY = 7_028_001  # arbitrary app-wide id for pg_advisory_lock
LOCK_WAIT_S = 180             # leaves headroom inside the 5 min command_timeout of both workflows
LOCK_POLL_S = 2


async def rebuild(pool, force: bool = False, lock_wait_s: float = LOCK_WAIT_S) -> dict:
    async with pool.acquire() as lock_conn:
        deadline = time.monotonic() + lock_wait_s
        waited = False
        while not await lock_conn.fetchval('SELECT pg_try_advisory_lock($1)', SITEMAP_LOCK_KEY):
            if time.monotonic() >= deadline:
                raise RuntimeError(f'another sitemap rebuild still running after {lock_wait_s:.0f}s; giving up')
            if not waited:
                print('sitemap_builder: another rebuild is running; waiting for it to finish')
                waited = True
            await asyncio.sleep(LOCK_POLL_S)
        try:
            return await _rebuild_locked(pool, force)
        finally:
            await lock_conn.execute('SELECT pg_advisory_unlock($1)', SITEMAP_LOCK_KEY)


async def _rebuild_locked(pool, force: bool = False) -> dict:
    now = datetime.now(timezone.utc)
    rows = [dict(r) for r in await pool.fetch(JOB_SQL)]
    registry = await load_registry(pool)
    enabled = enabled_job_categories(registry)
    files = build_files(rows, now, enabled)
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
    per_cat = {c: sum(f[2] for f in files.values() if f[0] == c) for c in enabled}
    return {'jobs_scanned': len(rows), 'urls': new_total, 'files': len(files), 'per_category': per_cat}
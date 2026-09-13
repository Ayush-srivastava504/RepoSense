# Batch-generates AI overview content for thin job/internship listings and
# writes it back to the `jobs` table (see migration 017). Meant to run on a
# schedule via .github/workflows/content-enrichment.yml, same pattern as
# scripts/generate-daily-posts.mjs for the blog.

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
import asyncpg
from configs.config import settings
from services.content_enrichment_service import ContentEnrichmentService, FALLBACK_MODEL
BATCH_LIMIT_DEFAULT = 100
THIN_DESCRIPTION_CHARS = 400
RE_ENRICH_DAYS_DEFAULT = 90
REQUEST_DELAY_S = 1.0
# Every per-job outcome line is printed with this prefix, pipe-delimited,
# so the GitHub Actions workflow can grep it out of the SSH step's
# captured stdout and turn it into a job-summary table (AI vs fallback,
# and which URL each row corresponds to) without the workflow needing to
# know anything about this script's log format beyond this one prefix.
ROW_PREFIX = 'ENRICH_ROW'

async def fetch_candidates(pool, limit: int, force_stale: bool, re_enrich_days: int):
    if force_stale:
        query = "\n            SELECT id, title, company, location, description, type, url\n            FROM jobs\n            WHERE is_active = true\n              AND length(coalesce(description, '')) < $1\n              AND (enriched_at IS NULL OR enriched_at < now() - ($3 || ' days')::interval)\n            ORDER BY enriched_at NULLS FIRST, posted_at DESC NULLS LAST\n            LIMIT $2\n        "
        return await pool.fetch(query, THIN_DESCRIPTION_CHARS, limit, str(re_enrich_days))
    query = "\n        SELECT id, title, company, location, description, type, url\n        FROM jobs\n        WHERE is_active = true\n          AND length(coalesce(description, '')) < $1\n          AND enriched_at IS NULL\n        ORDER BY posted_at DESC NULLS LAST\n        LIMIT $2\n    "
    return await pool.fetch(query, THIN_DESCRIPTION_CHARS, limit)

def _log_row(tag: str, url, title, company) -> None:
    # Pipe-delimited, one line per job. Strip '|' and newlines from the
    # free-text fields so a stray character in a scraped title/company
    # can't shift columns when this gets parsed back out downstream.
    safe = lambda v: str(v or '').replace('|', '/').replace('\n', ' ').strip()
    print(f'{ROW_PREFIX}|{tag}|{safe(url)}|{safe(title)} @ {safe(company)}')


async def write_result(pool, job_id: str, overview: str, keywords: list[str], model: str):
    await pool.execute('\n        UPDATE jobs\n        SET enriched_overview = $2,\n            enriched_keywords = $3,\n            enriched_model = $4,\n            enriched_at = now()\n        WHERE id = $1\n        ', job_id, overview, keywords, model)

async def mark_attempted(pool, job_id: str):
    await pool.execute('UPDATE jobs SET enriched_at = now() WHERE id = $1', job_id)

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--limit', type=int, default=BATCH_LIMIT_DEFAULT)
    parser.add_argument('--force-stale', action='store_true', help='Also re-enrich rows older than --re-enrich-days')
    parser.add_argument('--re-enrich-days', type=int, default=RE_ENRICH_DAYS_DEFAULT)
    parser.add_argument('--dry-run', action='store_true', help="Generate content and log it, but don't write to the DB")
    parser.add_argument('--no-fallback', action='store_true', help='Skip rows instead of using the template fallback when GROQ_API_KEY is unset or a request fails')
    args = parser.parse_args()
    service = ContentEnrichmentService()
    if not service.enabled:
        print('[enrich_job_content] GROQ_API_KEY not set — using template fallback content (pass --no-fallback to skip instead).' if not args.no_fallback else '[enrich_job_content] GROQ_API_KEY not set — skipping enrichment run (this is a no-op, not a failure).')
        if args.no_fallback:
            return
    if not settings.DATABASE_URL:
        print('[enrich_job_content] DATABASE_URL not set — cannot run.')
        sys.exit(1)
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        rows = await fetch_candidates(pool, args.limit, args.force_stale, args.re_enrich_days)
        print(f'[enrich_job_content] {len(rows)} candidate listing(s) found')
        enriched, skipped, ai_count, fallback_count = (0, 0, 0, 0)
        for row in rows:
            result = await service.enrich(title=row['title'], company=row['company'], location=row['location'], description=row['description'], job_type=row['type'], allow_fallback=not args.no_fallback)
            if result is None:
                skipped += 1
                _log_row('SKIP', row['url'], row['title'], row['company'])
                if not args.dry_run:
                    await mark_attempted(pool, row['id'])
                time.sleep(REQUEST_DELAY_S)
                continue
            is_fallback = result.model == FALLBACK_MODEL
            if is_fallback:
                fallback_count += 1
            else:
                ai_count += 1
            _log_row('FALLBACK' if is_fallback else 'AI', row['url'], row['title'], row['company'])
            if args.dry_run:
                print(f'--- {row["title"]} @ {row["company"]} ({result.model}) ---')
                print(result.overview)
                print('keywords:', result.keywords)
                print()
            else:
                await write_result(pool, row['id'], result.overview, result.keywords, result.model)
            enriched += 1
            time.sleep(REQUEST_DELAY_S)
        print(f'[enrich_job_content] done — enriched {enriched} (ai={ai_count}, fallback={fallback_count}), skipped {skipped} (of {len(rows)})')
    finally:
        await pool.close()
if __name__ == '__main__':
    asyncio.run(main())

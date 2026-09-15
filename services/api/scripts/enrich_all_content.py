# Bulk / fallback content-enrichment runner for jobs and internships (both
# live in the same `jobs` table, distinguished by the `type` column — no
# separate handling needed): job overview content (all of them, not just
# thin ones, in --bulk mode), and structured fields
# (allowed_degrees/required_skills/etc. — Phase B of
# INDEXING_RECOVERY_PLAN.md, same bulk backfill shape as the overview
# pass). Meant as the fallback content pass that runs after the targeted
# enrich_job_content.py job — same Groq-backed pattern, but with a
# deterministic template/rule-based fallback (see
# content_enrichment_service.py / structured_enrichment_service.py) so a
# run always produces usable content even without GROQ_API_KEY set or if
# a request fails, and can be pointed at the whole table instead of only
# thin/never-enriched rows.
#
# Company-page and SEO-blog-post enrichment (CompanyEnrichmentService)
# was removed — this deployment's frontend is Vercel-only with no blog
# content pipeline wired to consume it, so that pass had nowhere to go.
#
# Usage:
#   python scripts/enrich_all_content.py --target jobs --bulk --limit 500
#   python scripts/enrich_all_content.py --target structured --bulk --limit 500
#   python scripts/enrich_all_content.py --target all --bulk

import argparse
import asyncio
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services.content_enrichment_service import ContentEnrichmentService
from services.structured_enrichment_service import StructuredEnrichmentService

BATCH_LIMIT_DEFAULT = 200
REQUEST_DELAY_S = 1.0


async def enrich_jobs(pool, args) -> dict:
    service = ContentEnrichmentService()
    if args.bulk:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true ORDER BY enriched_at NULLS FIRST, posted_at DESC NULLS LAST LIMIT $1"
    else:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND enriched_at IS NULL ORDER BY posted_at DESC NULLS LAST LIMIT $1"
    rows = await pool.fetch(query, args.limit)
    print(f'[enrich_all_content] jobs: {len(rows)} candidate(s) (bulk={args.bulk}, ai_enabled={service.enabled})')
    enriched = 0
    for row in rows:
        result = await service.enrich(
            title=row['title'], company=row['company'], location=row['location'],
            description=row['description'], job_type=row['type'],
            allow_fallback=True,
        )
        if result is None:
            time.sleep(REQUEST_DELAY_S)
            continue
        if not args.dry_run:
            await pool.execute(
                'UPDATE jobs SET enriched_overview = $2, enriched_keywords = $3, enriched_model = $4, enriched_at = now() WHERE id = $1',
                row['id'], result.overview, result.keywords, result.model,
            )
        enriched += 1
        time.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] jobs: enriched {enriched}/{len(rows)}')
    return {'attempted': len(rows), 'enriched': enriched}


async def enrich_structured(pool, args) -> dict:
    # Phase B (INDEXING_RECOVERY_PLAN.md): structured_enrichment.py's crawl-time
    # pass only ever sees *this run's* newly-scraped jobs, capped at
    # STRUCTURED_ENRICHMENT_BATCH_LIMIT — identical shape to the
    # enriched_overview backlog problem enrich_jobs() above already backfills.
    # This is that same backfill, for the structured columns from
    # migrations/021_structured_job_details.sql instead.
    service = StructuredEnrichmentService()
    if args.bulk:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true ORDER BY structured_description IS NOT NULL, posted_at DESC NULLS LAST LIMIT $1"
    else:
        query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND structured_description IS NULL LIMIT $1"
    rows = await pool.fetch(query, args.limit)
    print(f'[enrich_all_content] structured: {len(rows)} candidate(s) (bulk={args.bulk}, ai_enabled={service.enabled})')
    enriched = 0
    for row in rows:
        result = await service.enrich(
            title=row['title'], company=row['company'], location=row['location'],
            description=row['description'], job_type=row['type'],
            allow_fallback=True,
        )
        if result is None:
            time.sleep(REQUEST_DELAY_S)
            continue
        if not args.dry_run:
            await pool.execute(
                """
                UPDATE jobs
                SET allowed_degrees = $2,
                    allowed_courses = $3,
                    allowed_specializations = $4,
                    allowed_passout_years = $5,
                    required_skills = $6,
                    notes_highlights = $7,
                    work_mode = $8,
                    experience_min = $9,
                    experience_max = $10,
                    job_function = $11,
                    structured_description = $12
                WHERE id = $1
                """,
                row['id'], result.allowed_degrees, result.allowed_courses,
                result.allowed_specializations, result.allowed_passout_years,
                result.required_skills, result.notes_highlights, result.work_mode,
                result.experience_min, result.experience_max, result.job_function,
                result.structured_description,
            )
        enriched += 1
        time.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] structured: enriched {enriched}/{len(rows)}')
    return {'attempted': len(rows), 'enriched': enriched}


async def main():
    parser = argparse.ArgumentParser(description='Bulk/fallback content enrichment for jobs and internships')
    parser.add_argument('--target', choices=['jobs', 'structured', 'all'], default='all')
    parser.add_argument('--limit', type=int, default=BATCH_LIMIT_DEFAULT)
    parser.add_argument('--bulk', action='store_true', help='Process all rows, not just never-enriched ones — for backfilling every page at once')
    parser.add_argument('--dry-run', action='store_true', help="Generate content and log it, but don't write to the DB")
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print('[enrich_all_content] DATABASE_URL not set — cannot run.')
        sys.exit(1)

    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        summary = {}
        if args.target in ('jobs', 'all'):
            summary['jobs'] = await enrich_jobs(pool, args)
        if args.target in ('structured', 'all'):
            summary['structured'] = await enrich_structured(pool, args)
        print('[enrich_all_content] done:', json.dumps(summary))
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())

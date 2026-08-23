# Bulk / fallback content-enrichment runner for every page type on the
# site: job listings (all of them, not just thin ones, in --bulk mode),
# company pages (overview + work-culture + review-style keywords, via
# CompanyEnrichmentService), and optional SEO blog posts about hiring at
# top companies. Meant as the fallback content pass that runs after the
# targeted enrich_job_content.py job — same Groq-backed pattern, but with
# a deterministic template fallback (see content_enrichment_service.py /
# company_enrichment_service.py) so a run always produces usable content
# even without GROQ_API_KEY set or if a request fails, and can be pointed
# at the whole table instead of only thin/never-enriched rows.
#
# Usage:
#   python scripts/enrich_all_content.py --target jobs --bulk --limit 500
#   python scripts/enrich_all_content.py --target companies --limit 200
#   python scripts/enrich_all_content.py --target all --bulk
#   python scripts/enrich_all_content.py --target companies --blog-posts --limit 20

import argparse
import asyncio
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services.content_enrichment_service import ContentEnrichmentService
from services.company_enrichment_service import CompanyEnrichmentService

BATCH_LIMIT_DEFAULT = 200
REQUEST_DELAY_S = 1.0
BLOG_DIR = Path(__file__).resolve().parents[3] / 'apps' / 'web' / 'content' / 'blog'


def slugify(value: str) -> str:
    value = value.lower()
    value = re.sub('[^a-z0-9]+', '-', value)
    return value.strip('-')[:80]


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


async def _fetch_company_rows(pool, limit: int):
    return await pool.fetch(
        """
        SELECT
            company,
            (array_agg(DISTINCT title))[1:10]    AS sample_titles,
            (array_agg(DISTINCT location) FILTER (WHERE location IS NOT NULL)) AS locations,
            count(*)                              AS job_count
        FROM jobs
        WHERE is_active = true AND company IS NOT NULL AND company != ''
        GROUP BY company
        ORDER BY job_count DESC
        LIMIT $1
        """,
        limit,
    )


async def enrich_companies(pool, args) -> dict:
    service = CompanyEnrichmentService()
    rows = await _fetch_company_rows(pool, args.limit)
    if not args.bulk:
        existing = await pool.fetch('SELECT company FROM company_profiles')
        already = {r['company'] for r in existing}
        rows = [r for r in rows if r['company'] not in already]
    print(f'[enrich_all_content] companies: {len(rows)} candidate(s) (bulk={args.bulk}, ai_enabled={service.enabled})')
    enriched = 0
    blog_posts_written = 0
    for row in rows:
        sample_titles = row['sample_titles'] or []
        locations = row['locations'] or []
        result = await service.enrich(company=row['company'], sample_titles=sample_titles, locations=locations)
        if result is None:
            time.sleep(REQUEST_DELAY_S)
            continue
        if not args.dry_run:
            await pool.execute(
                """
                INSERT INTO company_profiles (company, overview, culture_summary, review_snippets, keywords, model, enriched_at)
                VALUES ($1, $2, $3, $4, $5, $6, now())
                ON CONFLICT (company) DO UPDATE SET
                    overview = EXCLUDED.overview,
                    culture_summary = EXCLUDED.culture_summary,
                    review_snippets = EXCLUDED.review_snippets,
                    keywords = EXCLUDED.keywords,
                    model = EXCLUDED.model,
                    enriched_at = now()
                """,
                row['company'], result.overview, result.culture_summary,
                json.dumps(result.review_snippets), result.keywords, result.model,
            )
        enriched += 1
        if args.blog_posts:
            if _write_company_blog_post(row['company'], result):
                blog_posts_written += 1
        time.sleep(REQUEST_DELAY_S)
    print(f'[enrich_all_content] companies: enriched {enriched}/{len(rows)}, blog posts written {blog_posts_written}')
    return {'attempted': len(rows), 'enriched': enriched, 'blog_posts_written': blog_posts_written}


def _write_company_blog_post(company: str, result) -> bool:
    """Write a fallback SEO blog post JSON (same schema as
    scripts/generate-daily-posts.mjs) covering work culture/reviews at
    this company, for pages/keywords the daily post generator hasn't
    reached yet. Skips companies that already have a post."""
    slug = slugify(f'{company}-work-culture-reviews')
    BLOG_DIR.mkdir(parents=True, exist_ok=True)
    out_path = BLOG_DIR / f'{slug}.json'
    if out_path.exists():
        return False
    body_parts = [
        result.overview,
        '## Work culture',
        result.culture_summary,
    ]
    if result.review_snippets:
        body_parts.append('## What candidates typically look for')
        body_parts.append('\n'.join(f'- {s}' for s in result.review_snippets))
    post = {
        'slug': slug,
        'title': f'{company}: Work Culture & What to Know Before Applying',
        'description': f'An overview of {company} as an employer — what they hire for, and what candidates typically want to know before applying.',
        'keyword': f'{company.lower()} work culture',
        'category': 'company-culture',
        'publishedAt': datetime.now(timezone.utc).isoformat(),
        'body': '\n\n'.join(body_parts),
        'faq': [],
    }
    out_path.write_text(json.dumps(post, indent=2), encoding='utf-8')
    return True


async def main():
    parser = argparse.ArgumentParser(description='Bulk/fallback content enrichment for jobs, companies, and SEO blog posts')
    parser.add_argument('--target', choices=['jobs', 'companies', 'all'], default='all')
    parser.add_argument('--limit', type=int, default=BATCH_LIMIT_DEFAULT)
    parser.add_argument('--bulk', action='store_true', help='Process all rows, not just never-enriched ones — for backfilling every page at once')
    parser.add_argument('--blog-posts', action='store_true', help='Also write a fallback work-culture/review blog post per enriched company')
    parser.add_argument('--dry-run', action='store_true', help="Generate content and log/write blog posts, but don't write to the DB")
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print('[enrich_all_content] DATABASE_URL not set — cannot run.')
        sys.exit(1)

    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        summary = {}
        if args.target in ('jobs', 'all'):
            summary['jobs'] = await enrich_jobs(pool, args)
        if args.target in ('companies', 'all'):
            summary['companies'] = await enrich_companies(pool, args)
        print('[enrich_all_content] done:', json.dumps(summary))
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())

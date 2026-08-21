#!/usr/bin/env python3
"""
Batch-generates AI overview content for thin job/internship listings and
writes it back to the `jobs` table (see migration 017). Meant to run on a
schedule via .github/workflows/content-enrichment.yml, same pattern as
scripts/generate-daily-posts.mjs for the blog.

Only touches rows that are:
  - is_active = true
  - enriched_at IS NULL (never attempted), or older than RE_ENRICH_DAYS
    (re-run on --force-stale, e.g. after prompt changes)
  - description shorter than THIN_DESCRIPTION_CHARS — the actual signal
    for "thin content"; a listing with a genuinely long, unique
    description doesn't need this.

Usage:
    python scripts/enrich_job_content.py                 # up to BATCH_LIMIT rows
    python scripts/enrich_job_content.py --limit 200
    python scripts/enrich_job_content.py --force-stale --limit 50

Requires DATABASE_URL and XAI_API_KEY in the environment. When run via
.github/workflows/content-enrichment.yml, that environment is the EC2
box's own docker-compose .env (passed through via `docker compose run
--rm --entrypoint python api scripts/enrich_job_content.py ...` over SSH)
— not GitHub Actions secrets, since Postgres here is only reachable
locally on that box. Exits 0 and logs
a warning (rather than failing the CI run) if XAI_API_KEY is unset, so the
workflow can be added without immediately requiring the secret.
"""

import argparse
import asyncio
import os
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

import asyncpg  # noqa: E402

from configs.config import settings  # noqa: E402
from services.content_enrichment_service import ContentEnrichmentService  # noqa: E402

BATCH_LIMIT_DEFAULT = 100
THIN_DESCRIPTION_CHARS = 400
RE_ENRICH_DAYS_DEFAULT = 90
# Stay well under xAI rate limits and be a polite API citizen.
REQUEST_DELAY_S = 1.0


async def fetch_candidates(pool, limit: int, force_stale: bool, re_enrich_days: int):
    if force_stale:
        query = """
            SELECT id, title, company, location, description, type
            FROM jobs
            WHERE is_active = true
              AND length(coalesce(description, '')) < $1
              AND (enriched_at IS NULL OR enriched_at < now() - ($3 || ' days')::interval)
            ORDER BY enriched_at NULLS FIRST, posted_at DESC NULLS LAST
            LIMIT $2
        """
        return await pool.fetch(
            query, THIN_DESCRIPTION_CHARS, limit, str(re_enrich_days)
        )

    query = """
        SELECT id, title, company, location, description, type
        FROM jobs
        WHERE is_active = true
          AND length(coalesce(description, '')) < $1
          AND enriched_at IS NULL
        ORDER BY posted_at DESC NULLS LAST
        LIMIT $2
    """
    return await pool.fetch(query, THIN_DESCRIPTION_CHARS, limit)


async def write_result(pool, job_id: str, overview: str, keywords: list[str], model: str):
    await pool.execute(
        """
        UPDATE jobs
        SET enriched_overview = $2,
            enriched_keywords = $3,
            enriched_model = $4,
            enriched_at = now()
        WHERE id = $1
        """,
        job_id,
        overview,
        keywords,
        model,
    )


async def mark_attempted(pool, job_id: str):
    # Even on a failed/skip attempt, stamp enriched_at so a persistently
    # bad row (e.g. garbage title/company from a scraper bug) doesn't get
    # retried every single run and burn API budget indefinitely. force-stale
    # runs will still pick it back up after RE_ENRICH_DAYS.
    await pool.execute(
        "UPDATE jobs SET enriched_at = now() WHERE id = $1", job_id
    )


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=BATCH_LIMIT_DEFAULT)
    parser.add_argument(
        "--force-stale",
        action="store_true",
        help="Also re-enrich rows older than --re-enrich-days",
    )
    parser.add_argument("--re-enrich-days", type=int, default=RE_ENRICH_DAYS_DEFAULT)
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Generate content and log it, but don't write to the DB",
    )
    args = parser.parse_args()

    service = ContentEnrichmentService()
    if not service.enabled:
        print(
            "[enrich_job_content] XAI_API_KEY not set — skipping enrichment "
            "run (this is a no-op, not a failure)."
        )
        return

    if not settings.DATABASE_URL:
        print("[enrich_job_content] DATABASE_URL not set — cannot run.")
        sys.exit(1)

    pool = await asyncpg.create_pool(
        settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60
    )

    try:
        rows = await fetch_candidates(
            pool, args.limit, args.force_stale, args.re_enrich_days
        )
        print(f"[enrich_job_content] {len(rows)} candidate listing(s) found")

        enriched, skipped = 0, 0

        for row in rows:
            result = await service.enrich(
                title=row["title"],
                company=row["company"],
                location=row["location"],
                description=row["description"],
                job_type=row["type"],
            )

            if result is None:
                skipped += 1
                if not args.dry_run:
                    await mark_attempted(pool, row["id"])
                time.sleep(REQUEST_DELAY_S)
                continue

            if args.dry_run:
                print(f"--- {row['title']} @ {row['company']} ---")
                print(result.overview)
                print("keywords:", result.keywords)
                print()
            else:
                await write_result(
                    pool, row["id"], result.overview, result.keywords, result.model
                )

            enriched += 1
            time.sleep(REQUEST_DELAY_S)

        print(
            f"[enrich_job_content] done — enriched {enriched}, "
            f"skipped {skipped} (of {len(rows)})"
        )
    finally:
        await pool.close()


if __name__ == "__main__":
    asyncio.run(main())

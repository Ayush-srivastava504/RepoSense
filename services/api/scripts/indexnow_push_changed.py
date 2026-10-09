# Module: scripts/indexnow_push_changed.py
#
# IndexNow push for jobs whose page CONTENT changed after they were last submitted.
#
# WHY THIS EXISTS
# phase_f_priority_index_push.py only selects jobs created today that were never submitted
# (indexnow_submitted_at IS NULL), capped per category. Once a job has been submitted it is never looked at
# again -- so when the AI pipeline later adds the overview (enriched_at) or the page sections
# (enriched_sections_at) the page changes but Bing/Copilot are never told. Bing's guidelines ask for
# IndexNow notification whenever content is added, updated or removed, in small timely submissions
# rather than big batches. (Removals are already covered by scripts/indexnow-submit-gone.mjs.)
#
# WHAT IT DOES
# Selects active, indexable jobs that were submitted before and whose real content timestamp is newer than
# that submission, sends their canonical URLs to IndexNow in small batches, and moves indexnow_submitted_at
# forward so each change is announced exactly once.
#
# "Real content change" is the same definition the sitemap <lastmod> uses (see content_modified_at() in
# src/services/sitemap_builder.py): enriched_sections_at, or enriched_at when an overview exists --
# enrich_job_content.mark_attempted() stamps enriched_at on failed attempts, which changes nothing on the page.
#
# USAGE
#   python scripts/indexnow_push_changed.py
#   python scripts/indexnow_push_changed.py --dry-run
#   python scripts/indexnow_push_changed.py --cap 300 --batch-size 100
#
# ENV: DATABASE_URL, INDEXNOW_KEY, INDEXNOW_HOST (same as phase_f_priority_index_push.py), SITE_URL.

import argparse
import asyncio
import sys
from pathlib import Path
from typing import Dict, List

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import asyncpg
import httpx
from configs.config import settings
from phase_f_priority_index_push import (  # single source of truth for URLs + the IndexNow call
    ROW_PREFIX,
    canonical_url,
    log_submission,
    mark_submitted,
    submit_indexnow,
)

DEFAULT_CAP = 500
DEFAULT_BATCH_SIZE = 100  # IndexNow allows 10,000 per POST; small batches keep updates timely and failures narrow

CHANGED_SQL = '''
SELECT id, title, company, location, salary, stipend, type, is_remote,
       (is_government IS TRUE OR source IN ('freejobalert', 'employment_news', 'ssc', 'upsc')) AS is_government
FROM jobs
WHERE is_active = TRUE
  AND indexnow_submitted_at IS NOT NULL
  AND (deadline IS NULL OR deadline > now())
  AND NOT (is_thin AND (enriched_overview IS NULL OR enriched_overview = ''))
  AND (
        enriched_sections_at > indexnow_submitted_at
     OR (enriched_overview IS NOT NULL AND enriched_overview <> '' AND enriched_at > indexnow_submitted_at)
  )
ORDER BY GREATEST(enriched_sections_at, enriched_at) DESC NULLS LAST
LIMIT $1
'''


async def select_changed(pool, cap: int) -> List[Dict]:
    return [dict(r) for r in await pool.fetch(CHANGED_SQL, cap)]


def batches(items: List[Dict], size: int) -> List[List[Dict]]:
    return [items[i:i + size] for i in range(0, len(items), max(1, size))]


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--cap', type=int, default=DEFAULT_CAP, help='Max changed jobs to announce per run')
    parser.add_argument('--batch-size', type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument('--dry-run', action='store_true', help='Select and log only, no submissions or DB writes')
    args = parser.parse_args()

    if not settings.DATABASE_URL:
        print('[indexnow_changed] DATABASE_URL not set -- cannot run.')
        sys.exit(1)

    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        jobs = await select_changed(pool, args.cap)
        print(f'[indexnow_changed] {len(jobs)} job(s) changed since their last IndexNow submission')
        if not jobs:
            return
        for job in jobs:
            job['url'] = canonical_url(job)

        if args.dry_run:
            for job in jobs:
                print(f"{ROW_PREFIX}|dry_run|OK|{job['url']}|{job['title']} @ {job['company']}".replace('\n', ' '))
            print('[indexnow_changed] --dry-run set -- no submissions made, no DB writes.')
            return

        failed = 0
        with httpx.Client() as client:
            for chunk in batches(jobs, args.batch_size):
                ok, status_code, snippet = submit_indexnow(client, [j['url'] for j in chunk])
                for job in chunk:
                    await log_submission(
                        pool, job_id=job['id'], url=job['url'], target='indexnow', is_top_company=False,
                        job_type=job.get('type'), status_code=status_code, ok=ok, response_snippet=snippet,
                    )
                    if ok:
                        await mark_submitted(pool, job['id'], 'indexnow_submitted_at')
                if not ok:
                    failed += len(chunk)
                print(f"[indexnow_changed] batch of {len(chunk)}: HTTP {status_code} {'OK' if ok else 'FAIL'} {snippet}")
        print(f'[indexnow_changed] done: {len(jobs) - failed} announced, {failed} failed (retried next run)')
        if failed:
            sys.exit(1)
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())

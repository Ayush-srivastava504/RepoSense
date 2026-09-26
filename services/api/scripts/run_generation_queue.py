# Drains `generation_tasks` (migrations/027_generation_tasks.sql) for
# task_type=job_content_enrichment. Meant to run often (every 15-30 min via
# queue-ingestion.yml) with a short time budget, so a freshly-crawled job
# gets its AI overview within the hour instead of waiting for
# job-content-enrichment.yml's once-a-day bulk pass over the whole table.
#
# This does NOT replace enrich_all_content.py --target jobs: that bulk pass
# still exists as the backstop that catches anything this queue missed
# (task lost before it was enqueued, a run that never got scheduled, etc.)
# and re-enriches stale/template-fallback rows, which isn't queue-shaped
# work. This only handles "a specific job just got crawled, do its one
# task now" -- the queue's job column is scoped by entity_id so the two
# pipelines can safely run over the same `jobs` rows without racing:
# whichever writes enriched_at/enriched_overview last wins, and both write
# the same shape of result.
#
# Usage:
#   python scripts/run_generation_queue.py
#   python scripts/run_generation_queue.py --batch-size 20 --max-runtime-minutes 10

import argparse
import asyncio
import os
import socket
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'src'))

import asyncpg
from configs.config import settings
from services import task_queue
from services.content_enrichment_service import ContentEnrichmentService, FALLBACK_MODEL

TASK_TYPE = 'job_content_enrichment'
BATCH_SIZE_DEFAULT = 20
REQUEST_DELAY_S = float(os.getenv('ENRICH_REQUEST_DELAY_S', '20'))
STUCK_AFTER_MINUTES = 30
WORKER_ID = f'{socket.gethostname()}:{os.getpid()}'


async def run_one_batch(pool, service, args) -> dict:
    tasks = await task_queue.claim_batch(pool, TASK_TYPE, WORKER_ID, args.batch_size)
    if not tasks:
        return {'claimed': 0, 'done': 0, 'failed': 0}
    job_ids = [t['entity_id'] for t in tasks]
    jobs_by_id = {
        row['id']: row
        for row in await pool.fetch(
            'SELECT id, title, company, location, description, type FROM jobs WHERE id = ANY($1)',
            job_ids,
        )
    }
    done = failed = 0
    for task in tasks:
        job = jobs_by_id.get(task['entity_id'])
        if job is None:
            # Job was deleted/deactivated out from under us between enqueue
            # and claim -- nothing to enrich, and retrying won't change that.
            await task_queue.fail(pool, task['id'], task['attempts'], 1, 'entity no longer in jobs table')
            failed += 1
            continue
        try:
            result = await service.enrich(
                title=job['title'], company=job['company'], location=job['location'],
                description=job['description'], job_type=job['type'],
                allow_fallback=not args.no_fallback,
            )
            if result is None:
                raise RuntimeError('enrichment returned no result (provider unavailable and fallback disabled)')
            await pool.execute(
                'UPDATE jobs SET enriched_overview = $2, enriched_keywords = $3, enriched_model = $4, enriched_at = now() WHERE id = $1',
                job['id'], result.overview, result.keywords, result.model,
            )
            await task_queue.complete(pool, task['id'])
            done += 1
        except Exception as exc:
            await task_queue.fail(pool, task['id'], task['attempts'], task['max_attempts'], str(exc))
            failed += 1
        await asyncio.sleep(REQUEST_DELAY_S)
        if _out_of_time(args):
            break
    return {'claimed': len(tasks), 'done': done, 'failed': failed}


def _out_of_time(args) -> bool:
    return args.deadline is not None and time.monotonic() >= args.deadline


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE_DEFAULT)
    parser.add_argument('--max-runtime-minutes', type=float, default=None, help='Stop claiming new batches after this many minutes')
    parser.add_argument('--no-fallback', action='store_true', help='Groq-written overviews only; a row Groq cannot handle is retried with backoff instead of getting template content')
    args = parser.parse_args()
    args.deadline = (time.monotonic() + args.max_runtime_minutes * 60) if args.max_runtime_minutes else None

    if not settings.DATABASE_URL:
        print('[run_generation_queue] DATABASE_URL not set — cannot run.')
        sys.exit(1)
    service = ContentEnrichmentService()
    pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=3, command_timeout=60)
    try:
        recovered = await task_queue.requeue_stuck(pool, TASK_TYPE, STUCK_AFTER_MINUTES)
        if recovered:
            print(f'[run_generation_queue] recovered {recovered} task(s) stuck in running (worker died mid-batch)')
        total = {'claimed': 0, 'done': 0, 'failed': 0}
        while not _out_of_time(args):
            batch = await run_one_batch(pool, service, args)
            for k in total:
                total[k] += batch[k]
            if batch['claimed'] < args.batch_size:
                break  # queue drained (or provider unavailable this round) — no point spinning
        print(f"[run_generation_queue] claimed {total['claimed']}, done {total['done']}, failed {total['failed']} (ai_enabled={service.enabled})")
    finally:
        await pool.close()


if __name__ == '__main__':
    asyncio.run(main())

# Module: src/services/task_queue.py
#
# Generic durable task queue on top of `generation_tasks`
# (migrations/027_generation_tasks.sql). Async (asyncpg) side, for API
# scripts/workers. The crawler enqueues the sync (psycopg2) way -- see
# `enqueue_generation_tasks_sync` in crawler/src/utils.py -- since it's a
# separate process/container that never imports this package.
#
# Pattern: enqueue() is called by a producer (crawler upsert, an API route,
# another script) any time it knows a piece of background work needs to
# happen. claim_batch()/complete()/fail() are called by a worker script that
# runs on its own schedule and drains whatever is waiting. Producer and
# consumer never need to run at the same time or know about each other
# beyond the row they share.
#
# Retry/backoff: fail() increments attempts and, while attempts remain,
# reschedules with exponential backoff (base_backoff_s * 2**attempts,
# capped) instead of the "mark it done anyway so it's never retried" bug
# this replaces (see enrich_job_content.py's old mark_attempted()). Once
# attempts >= max_attempts the row is left as 'failed' -- visible for
# inspection, out of the claim queue, not silently retried forever.

import json
from typing import Any, Optional

MAX_BACKOFF_S = 6 * 60 * 60  # never push a retry out more than 6h


async def enqueue(pool, task_type: str, entity_id: str, payload: Optional[dict] = None, max_attempts: int = 5) -> bool:
    """Insert a pending task. No-op (returns False) if an active
    (pending/running) task already exists for this (task_type, entity_id) --
    safe to call on every crawl/upsert without piling up duplicate work."""
    status = await pool.execute(
        '''
        INSERT INTO generation_tasks (task_type, entity_id, payload, max_attempts)
        VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (task_type, entity_id) WHERE status IN ('pending', 'running')
        DO NOTHING
        ''',
        task_type, entity_id, json.dumps(payload or {}), max_attempts,
    )
    return status == 'INSERT 0 1'


async def claim_batch(pool, task_type: str, worker_id: str, batch_size: int = 20) -> list:
    """Atomically claim up to `batch_size` pending, due tasks of `task_type`
    for `worker_id`, marking them 'running'. Safe for multiple workers to
    call concurrently (FOR UPDATE SKIP LOCKED) -- no two workers ever claim
    the same row."""
    rows = await pool.fetch(
        '''
        WITH claimed AS (
            SELECT id
            FROM generation_tasks
            WHERE task_type = $1
              AND status = 'pending'
              AND available_at <= now()
            ORDER BY available_at
            FOR UPDATE SKIP LOCKED
            LIMIT $2
        )
        UPDATE generation_tasks AS t
        SET status = 'running', locked_by = $3, locked_at = now(), updated_at = now()
        FROM claimed
        WHERE t.id = claimed.id
        RETURNING t.id, t.entity_id, t.payload, t.attempts, t.max_attempts
        ''',
        task_type, batch_size, worker_id,
    )
    return rows


async def complete(pool, task_id: int) -> None:
    await pool.execute(
        "UPDATE generation_tasks SET status = 'done', updated_at = now() WHERE id = $1",
        task_id,
    )


async def fail(pool, task_id: int, attempts: int, max_attempts: int, error: str, base_backoff_s: int = 60) -> None:
    """Record a failed attempt. Reschedules with exponential backoff while
    attempts remain; otherwise leaves the row as 'failed' for inspection."""
    next_attempts = attempts + 1
    error = (error or '')[:2000]
    if next_attempts >= max_attempts:
        await pool.execute(
            '''
            UPDATE generation_tasks
            SET status = 'failed', attempts = $2, last_error = $3, updated_at = now()
            WHERE id = $1
            ''',
            task_id, next_attempts, error,
        )
        return
    backoff_s = min(base_backoff_s * (2 ** attempts), MAX_BACKOFF_S)
    await pool.execute(
        '''
        UPDATE generation_tasks
        SET status = 'pending', attempts = $2, last_error = $3,
            available_at = now() + ($4 * INTERVAL '1 second'), updated_at = now()
        WHERE id = $1
        ''',
        task_id, next_attempts, error, backoff_s,
    )


async def requeue_stuck(pool, task_type: str, older_than_minutes: int = 30) -> int:
    """A worker that dies mid-batch leaves rows 'running' forever (no
    process left to complete() or fail() them). Call this at the start of a
    worker run to put anything stuck for longer than a normal task should
    ever take back into 'pending'. Returns the number of rows recovered."""
    result = await pool.execute(
        '''
        UPDATE generation_tasks
        SET status = 'pending', locked_by = NULL, locked_at = NULL, updated_at = now()
        WHERE task_type = $1
          AND status = 'running'
          AND locked_at < now() - ($2 * INTERVAL '1 minute')
        ''',
        task_type, older_than_minutes,
    )
    # asyncpg execute() returns e.g. "UPDATE 3"
    try:
        return int(result.split()[-1])
    except (ValueError, IndexError):
        return 0

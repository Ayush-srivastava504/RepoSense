-- Generic durable task queue for background generation/ingestion work
-- (job content enrichment today; company enrichment, translations, and
-- government-job intake are meant to move onto this same table next).
--
-- Why Postgres and not Redis or SQS: Redis is already deployed here but is
-- explicitly best-effort everywhere it's used (rate_limit.py fails open
-- when Redis is down) and its docker-compose service has no volume, so a
-- restart wipes it -- fine for a rate counter, wrong for tasks that must
-- survive a redeploy. SQS would be a brand-new AWS resource/IAM edge for a
-- single-EC2-host stack that already does everything via docker compose +
-- cron, with no throughput need that justifies it. Postgres is already the
-- one thing every producer (crawler, via psycopg2) and every consumer
-- (API/scripts, via asyncpg) here talks to directly, and
-- `SELECT ... FOR UPDATE SKIP LOCKED` is the standard durable, transactional
-- queue pattern on top of it -- zero new infra, fits the existing
-- numbered-migration system.
--
-- One row = one unit of work: "run task_type for entity_id". Claiming,
-- retrying with backoff, and giving up after max_attempts all live here
-- instead of being reinvented (or silently skipped) per script.

CREATE TABLE generation_tasks (
    id           BIGSERIAL PRIMARY KEY,
    task_type    TEXT        NOT NULL,           -- 'job_content_enrichment' today; 'company_enrichment' / 'job_translation' / 'government_job_intake' etc. later
    entity_id    TEXT        NOT NULL,            -- jobs.id, company_profiles.id, etc. -- meaning is scoped by task_type
    payload      JSONB       NOT NULL DEFAULT '{}',
    status       TEXT        NOT NULL DEFAULT 'pending',  -- pending | running | done | failed
    attempts     INT         NOT NULL DEFAULT 0,
    max_attempts INT         NOT NULL DEFAULT 5,
    last_error   TEXT,
    available_at TIMESTAMP   NOT NULL DEFAULT now(),  -- claimable once now() >= this; pushed forward on backoff
    locked_by    TEXT,                                -- worker id that currently holds a 'running' row, for debugging stuck rows
    locked_at    TIMESTAMP,
    created_at   TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at   TIMESTAMP   NOT NULL DEFAULT now()
);

-- At most one active (pending/running) task per (task_type, entity_id): the
-- crawler can enqueue the same job on every re-crawl without creating
-- duplicate work, via ON CONFLICT (task_type, entity_id) DO NOTHING scoped
-- to this partial index. A 'done' or 'failed' row doesn't block a future
-- re-enqueue (e.g. a re-enrichment pass), only an already-queued one does.
CREATE UNIQUE INDEX idx_generation_tasks_active_unique
    ON generation_tasks (task_type, entity_id)
    WHERE status IN ('pending', 'running');

-- Claim query shape: WHERE task_type = ? AND status = 'pending' AND
-- available_at <= now() ORDER BY available_at ... FOR UPDATE SKIP LOCKED.
CREATE INDEX idx_generation_tasks_claim
    ON generation_tasks (task_type, status, available_at);

COMMENT ON TABLE generation_tasks IS
    'Durable work queue (SELECT ... FOR UPDATE SKIP LOCKED pattern). One row per (task_type, entity_id) unit of background generation/ingestion work.';

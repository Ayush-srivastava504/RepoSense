-- Production schema had drifted from 003_jobs.sql: jobs.created_at was
-- missing, crashing deactivate_stale_jobs() every run. Idempotent add.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
UPDATE jobs SET created_at = COALESCE(created_at, last_seen_at, posted_at, CURRENT_TIMESTAMP) WHERE created_at IS NULL;

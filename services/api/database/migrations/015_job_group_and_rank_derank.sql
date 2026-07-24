-- Rank / de-rank system + the "software engineer / sales / finance / other"
-- job-group filter. Purely additive: no existing column, index, or
-- constraint is touched, so the current crawler writes/upserts and API
-- queries keep working unmodified.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS job_group    TEXT      DEFAULT 'other',
    ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Backfill: everything already in the table was, by definition, last seen
-- whenever it was first inserted (created_at), or posted_at if that's
-- earlier/more meaningful. Without this, every pre-existing row would
-- otherwise look "just seen" (default CURRENT_TIMESTAMP) or, worse, look
-- stale on the very next deactivation pass.
UPDATE jobs
SET last_seen_at = COALESCE(posted_at, created_at)
WHERE last_seen_at IS NULL OR last_seen_at = created_at;

-- Powers the "Software Engineer / Sales / Finance / Other" filter without
-- scanning the whole active-jobs set.
CREATE INDEX IF NOT EXISTS idx_jobs_active_group_posted
    ON jobs (is_active, job_group, posted_at DESC);

-- Used by deactivate_stale_jobs() (crawler/src/utils.py) to find listings
-- the crawler hasn't re-confirmed recently — the hard-cutoff half of the
-- rank/de-rank system. The soft half (gradually lowering a listing's
-- position as it ages) lives in the ranking SQL in
-- services/api/src/routes/jobs.py (RANKING_EXPRESSION).
CREATE INDEX IF NOT EXISTS idx_jobs_active_last_seen
    ON jobs (is_active, last_seen_at);

COMMENT ON COLUMN jobs.job_group IS
    'Coarse bucket for the top-level job filter: software | sales | finance | other. See CATEGORY_TO_GROUP in crawler/src/processors/enricher.py.';
COMMENT ON COLUMN jobs.last_seen_at IS
    'Last time the crawler re-confirmed this listing was still live. Refreshed by upsert_jobs() ON CONFLICT; drives deactivate_stale_jobs() (rank/de-rank hard cutoff, default 30 days).';

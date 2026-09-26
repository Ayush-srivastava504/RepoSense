-- Migration 025: deactivated_at
--
-- WHY: /gone-ids and /gone-urls (services/api/src/routes/jobs.py) need to
-- know WHEN a job was deactivated, to serve the most-recently-gone rows
-- first and to let /gone-urls window "jobs gone in the last N days" for
-- IndexNow submission. Neither exists today -- the only timestamp on a
-- gone job is last_seen_at, which is when the crawler last saw it ACTIVE,
-- not when is_active flipped to false. Filtering/ordering by last_seen_at
-- (as /gone-ids currently does) silently prioritizes the wrong rows: a job
-- deactivated today after being last crawled three weeks ago sorts as if
-- it went gone three weeks ago.
--
-- There are at least two code paths that set is_active = false
-- (services/api/src/routes/jobs.py, services/api/crawler/src/utils.py)
-- plus ad-hoc operational SQL (e.g. a manual bulk prune). Rather than
-- editing every call site and hoping none are missed later, a trigger
-- sets deactivated_at from ANY UPDATE that flips is_active true -> false,
-- including raw SQL run directly against the DB.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;

-- Backfill for rows already inactive before this migration: last_seen_at
-- is an approximation (when the crawler last saw it active, not when it
-- was actually deactivated), which is better than NULL but not exact.
-- Only rows deactivated AFTER this migration ships get an exact
-- deactivated_at, via the trigger below.
UPDATE jobs
SET deactivated_at = last_seen_at
WHERE is_active = false
  AND deactivated_at IS NULL;

CREATE OR REPLACE FUNCTION set_job_deactivated_at()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.is_active = true AND NEW.is_active = false THEN
        NEW.deactivated_at := now();
    ELSIF OLD.is_active = false AND NEW.is_active = true THEN
        -- Reactivated (should be rare -- product decision is to avoid
        -- re-flipping pruned jobs). Clear it: the job isn't gone anymore.
        NEW.deactivated_at := NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_jobs_deactivated_at ON jobs;
CREATE TRIGGER trg_jobs_deactivated_at
    BEFORE UPDATE OF is_active ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION set_job_deactivated_at();

CREATE INDEX IF NOT EXISTS idx_jobs_deactivated_at
    ON jobs (deactivated_at DESC)
    WHERE is_active = false;

-- Adds support for two new job categories: Remote/international jobs
-- (Himalayas, Remote OK, We Work Remotely, Remotive) and Government jobs
-- (Employment News, SSC, UPSC). Purely additive — existing columns,
-- indexes, and the current crawler upsert path keep working unmodified.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS is_remote           BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_government       BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS country             TEXT        DEFAULT 'India',
    ADD COLUMN IF NOT EXISTS department          TEXT,
    ADD COLUMN IF NOT EXISTS vacancies           TEXT,
    ADD COLUMN IF NOT EXISTS notification_number TEXT;

-- Powers /remote-jobs (WHERE is_remote = true) and /government-jobs
-- (WHERE is_government = true) without scanning the whole active-jobs set.
CREATE INDEX IF NOT EXISTS idx_jobs_active_remote_posted
    ON jobs (is_active, is_remote, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_active_government_posted
    ON jobs (is_active, is_government, posted_at DESC);

COMMENT ON COLUMN jobs.is_remote IS
    'True for jobs sourced from remote-first boards (Himalayas, Remote OK, We Work Remotely, Remotive) or detected as remote from title/location.';
COMMENT ON COLUMN jobs.is_government IS
    'True for jobs sourced from government recruitment sites (Employment News, SSC, UPSC).';
COMMENT ON COLUMN jobs.country IS
    'Best-effort country for the role. Defaults to India; remote-source jobs may carry US/UK/Worldwide etc.';
COMMENT ON COLUMN jobs.department IS
    'Government department/office issuing the notification (e.g. "Ministry of Railways"). Government-source jobs only.';
COMMENT ON COLUMN jobs.vacancies IS
    'Number of vacancies as published in the notification, kept as text since sources publish it inconsistently (e.g. "1,234 posts").';
COMMENT ON COLUMN jobs.notification_number IS
    'Official notification/advertisement number for the recruitment, when published (Employment News, SSC, UPSC).';

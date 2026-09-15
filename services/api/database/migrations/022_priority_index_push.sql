-- Phase F — same-day priority indexing push (INDEXING_RECOVERY_PLAN.md).
-- Every crawl run produces a handful of high-value listings (big/known
-- company, high confidence_score, posted today) mixed in with the rest of
-- the day's scrape. Phase A-E made the *sitemap* stop feeding Google
-- low-value pages, but the sitemap is still a pull signal — Google decides
-- when (or whether) to re-crawl it. This migration adds the bookkeeping
-- for a push signal instead: scripts/phase_f_priority_index_push.py
-- selects today's best jobs/internships and submits their URLs directly
-- to IndexNow (Bing/Yandex/Seznam/Naver) and Google's Indexing API
-- (legitimate here specifically because these pages carry JobPosting
-- structured data — see lib/structuredData.ts's jobPostingSchema()).
--
-- Two nullable timestamp columns on `jobs` give the selection query cheap,
-- no-join idempotency ("don't resubmit a job I already pushed"). The
-- separate log table is the audit trail: one row per submission attempt,
-- kept even for jobs that get resubmitted, so a bad run can be diagnosed
-- without touching the jobs table itself.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS indexnow_submitted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS google_indexing_submitted_at TIMESTAMP;

COMMENT ON COLUMN jobs.indexnow_submitted_at IS
    'Set once this job''s URL has been submitted to IndexNow (api.indexnow.org). NULL = not yet pushed. See scripts/phase_f_priority_index_push.py.';
COMMENT ON COLUMN jobs.google_indexing_submitted_at IS
    'Set once this job''s URL has been submitted to Google''s Indexing API (indexing.googleapis.com). NULL = not yet pushed. Only ever set for JobPosting-schema pages — see scripts/phase_f_priority_index_push.py header for why that scoping matters.';

-- Selection query filters on is_active + created_at::date (same-day
-- scraped) + indexnow_submitted_at IS NULL, ordered by the same
-- top-company/confidence ranking routes/jobs.py already uses. This index
-- covers that filter without a sequential scan as the table grows.
CREATE INDEX IF NOT EXISTS idx_jobs_priority_push_pending
    ON jobs (created_at DESC, confidence_score DESC)
    WHERE is_active = TRUE AND indexnow_submitted_at IS NULL;

CREATE TABLE IF NOT EXISTS priority_index_log (
    id               SERIAL PRIMARY KEY,
    job_id           TEXT REFERENCES jobs(id) ON DELETE SET NULL,
    url              TEXT NOT NULL,
    target           TEXT NOT NULL,          -- 'indexnow' | 'google_indexing'
    is_top_company   BOOLEAN NOT NULL DEFAULT FALSE,
    job_type         TEXT,                   -- 'internship' | other, at push time
    status_code      INTEGER,
    ok               BOOLEAN NOT NULL DEFAULT FALSE,
    response_snippet TEXT,
    submitted_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE priority_index_log IS
    'Audit trail for Phase F same-day priority indexing pushes — one row per (job, target) submission attempt. jobs.indexnow_submitted_at / google_indexing_submitted_at are the fast idempotency check; this table is for debugging/quota review (e.g. how many of today''s 200 Google Indexing API quota were used, and on what).';

CREATE INDEX IF NOT EXISTS idx_priority_index_log_submitted_at
    ON priority_index_log (submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_priority_index_log_target_date
    ON priority_index_log (target, submitted_at);

-- Adds lightweight company-verification and ranking fields to the existing
-- jobs table. Purely additive: no existing column, index, or constraint is
-- touched, so the current crawler writes/upserts keep working unmodified.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS confidence_score   INTEGER     DEFAULT 0,
    ADD COLUMN IF NOT EXISTS confidence_label   TEXT        DEFAULT 'unverified',
    ADD COLUMN IF NOT EXISTS apply_domain       TEXT,
    ADD COLUMN IF NOT EXISTS is_official_domain BOOLEAN     DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS domain_similarity  REAL        DEFAULT 0,
    ADD COLUMN IF NOT EXISTS deadline           TIMESTAMP;

-- confidence_score drives both the "Verified Source" badge and the
-- confidence_boost term in the first-page ranking query.
CREATE INDEX IF NOT EXISTS idx_jobs_confidence_score
    ON jobs (confidence_score DESC);

-- Used by the ranked ordering query (company + freshness + confidence) and
-- by the /api/jobs/featured endpoint.
CREATE INDEX IF NOT EXISTS idx_jobs_active_confidence_posted
    ON jobs (is_active, confidence_score DESC, posted_at DESC);

COMMENT ON COLUMN jobs.confidence_score IS
    '0-100 score from calculate_company_score(); see crawler/src/processors/trust.py';
COMMENT ON COLUMN jobs.confidence_label IS
    'One of: verified, high_confidence, review_recommended, unverified';
COMMENT ON COLUMN jobs.apply_domain IS
    'Registrable domain extracted from the apply URL (e.g. ey.com)';
COMMENT ON COLUMN jobs.is_official_domain IS
    'True only when apply_domain matches a manually curated company->domain mapping';
COMMENT ON COLUMN jobs.deadline IS
    'Application deadline / validThrough for JobPosting structured data, when known';

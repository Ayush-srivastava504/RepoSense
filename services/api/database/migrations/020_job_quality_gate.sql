-- Adds the thin-content / legitimacy quality gate that was previously
-- entirely absent from the pipeline: any scraped job, however thin or
-- however broken its apply_url, flowed straight to a DB write. See
-- crawler/src/processors/quality.py (ported from FresherFlow's
-- legitimacy-detector.service.ts + extractor.ts's isRejectedApplyUrl).
--
-- Jobs whose apply_url is unsalvageable (homepage, search page, listing
-- page, blog, govt portal, aggregator redirect, ...) are now rejected
-- before they ever reach upsert_jobs — they will not appear in this
-- table at all. Everything that does land here now carries a
-- legitimacy_state / quality_score / is_thin verdict instead of being
-- treated as equally trustworthy by default.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS legitimacy_state TEXT,
    ADD COLUMN IF NOT EXISTS legitimacy_reasons TEXT[],
    ADD COLUMN IF NOT EXISTS quality_score INTEGER,
    ADD COLUMN IF NOT EXISTS is_thin BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN jobs.legitimacy_state IS
    'verified | likely | uncertain — deterministic verdict from processors/quality.py assess_legitimacy(). uncertain is the conservative default.';
COMMENT ON COLUMN jobs.legitimacy_reasons IS
    'Human-readable reasons behind legitimacy_state, for debugging/ops review.';
COMMENT ON COLUMN jobs.quality_score IS
    '0-100 composite used to prioritize enrichment (thinnest/lowest-quality first) — see content_enrichment.py.';
COMMENT ON COLUMN jobs.is_thin IS
    'TRUE when description length is under the 300-char threshold at crawl time. Existing rows default to FALSE (unknown) until the next crawl re-scores them — this is a flag for triage, not a hard exclusion.';

-- Index to support "give me the thinnest active jobs first" enrichment
-- queries without a sequential scan over the whole table.
CREATE INDEX IF NOT EXISTS idx_jobs_quality_priority
    ON jobs (is_thin DESC, quality_score ASC)
    WHERE is_active = TRUE;

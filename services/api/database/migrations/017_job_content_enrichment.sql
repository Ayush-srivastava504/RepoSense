-- AI-generated enrichment content for thin job/internship postings.
--
-- Many scraped listings (see services/api/crawler) are little more than a
-- title, company, and a couple of lines — enough to be useful to a human
-- but thin enough that Google's crawler deprioritizes indexing them (shows
-- up as "Discovered - currently not indexed" in Search Console). This adds
-- storage for a short, unique, keyword-relevant overview generated per
-- listing — company context, likely day-to-day work, why it fits the
-- posted role — so each page has substantive, non-boilerplate content
-- beyond the raw scrape. See services/api/src/services/content_enrichment_service.py
-- and services/api/scripts/enrich_job_content.py.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_overview   TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_keywords   TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_model      TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_at         TIMESTAMP;

-- Lets the batch enrichment job cheaply find rows that still need content
-- (enriched_at IS NULL) without a full table scan, and lets it skip rows
-- that were already attempted recently on re-runs.
CREATE INDEX IF NOT EXISTS idx_jobs_enriched_at
    ON jobs (enriched_at)
    WHERE is_active = true;

-- Government rows crawled before migration 014 existed (or by an earlier scraper) have is_government = FALSE,
-- so they showed up on /jobs and /internships. 014 added the column with DEFAULT FALSE and never backfilled it.
-- The API now also treats these sources as government regardless of the flag (routes/jobs.py
-- GOVERNMENT_SOURCES_SQL); this migration fixes the stored data so the two agree and indexes can use the flag.
-- Safe to re-run.
UPDATE jobs
SET is_government = TRUE
WHERE is_government IS NOT TRUE
  AND source IN ('freejobalert', 'employment_news', 'ssc', 'upsc');

-- Grounded, AI-written page sections for job detail pages (responsibilities, preparation tips, common
-- mistakes, ATS keywords, FAQ answers). One JSONB document per job:
--   {"responsibilities": [str], "prep_tips": [str], "common_mistakes": [str], "ats_keywords": [str],
--    "faqs": [{"q": str, "a": str}]}
-- Written by scripts/enrich_all_content.py --target sections; NULL = not generated yet (page simply omits the sections).
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_sections JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_sections_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS enriched_sections_model TEXT;
CREATE INDEX IF NOT EXISTS idx_jobs_sections_pending ON jobs (posted_at DESC NULLS LAST)
    WHERE is_active = true AND enriched_sections IS NULL;

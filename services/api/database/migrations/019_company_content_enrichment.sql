-- AI-generated enrichment content for company pages: an overview, a
-- work-culture/review-style blurb, and search keywords, generated once
-- per company from the jobs already scraped for them (see
-- services/api/src/services/company_enrichment_service.py and
-- services/api/scripts/enrich_all_content.py). Used as fallback content
-- on company listing pages that would otherwise have nothing but a raw
-- job count.

CREATE TABLE IF NOT EXISTS company_profiles (
    company           TEXT PRIMARY KEY,
    overview          TEXT,
    culture_summary   TEXT,
    review_snippets   JSONB,
    keywords          TEXT[],
    model             TEXT,
    enriched_at       TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_company_profiles_enriched_at
    ON company_profiles (enriched_at);

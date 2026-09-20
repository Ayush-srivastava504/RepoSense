-- Fact sheet behind each company profile (see
-- services/api/src/services/company_facts_service.py and
-- services/api/scripts/enrich_all_content.py --target companies).
--
-- `facts` holds the aggregates the overview is written from (listing counts,
-- top locations / skills / role families, work modes, ...), so a page can render
-- the numbers directly. `overview` and `keywords` are derived from it and
-- `model` is 'facts-v1'. `culture_summary` and `review_snippets` from migration
-- 019 are no longer generated (they were speculative); the columns are kept and
-- left NULL rather than dropped.

ALTER TABLE company_profiles
    ADD COLUMN IF NOT EXISTS facts JSONB;

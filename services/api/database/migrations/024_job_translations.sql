-- Locale-aware job content, per IMPLEMENTATION_PLAN.md §7. One row pe
-- (job, locale) that has actually been through translation — a job with no
-- row for a given locale simply has no translated content for it, and its
-- detail page keeps canonicalizing to English (today's behavior), rather
-- than advertising a URL that would just be English content again.
--
-- Only jobs that have already been through content enrichment
-- (enriched_overview IS NOT NULL) and pass the same freshness/quality tier
-- as the sitemap (lib/sitemapJobs.ts's isJobForSitemap) are ever
-- candidates — translating raw, unvetted scraped text was explicitly ruled
-- out in the plan.

CREATE TABLE IF NOT EXISTS job_translations (
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    locale TEXT NOT NULL,
    title TEXT NOT NULL,
    overview TEXT,
    structured_description TEXT,
    model TEXT NOT NULL,
    translated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (job_id, locale)
);

-- Used by GET /api/jobs/{id}?locale=xx to check "does this job have a
-- translation for this locale" and to list translated_locales for
-- job-aware hreflang, without scanning the whole table.
CREATE INDEX IF NOT EXISTS idx_job_translations_locale ON job_translations (locale);

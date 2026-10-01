-- Prebuilt job sitemap files. Built out-of-band by scripts/build_sitemaps.py
-- (scheduled) straight from the jobs table, served by GET /api/sitemap/files/*.
-- The web tier no longer paginates the whole job list on every sitemap request,
-- which is what produced the intermittent 503s (rate limit / total drift).
CREATE TABLE IF NOT EXISTS sitemap_cache (
    file_name  TEXT PRIMARY KEY,               -- e.g. 'jobs-1.xml'
    category   TEXT NOT NULL,                  -- jobs | internships | remote-jobs | government-jobs
    page       INTEGER NOT NULL,
    url_count  INTEGER NOT NULL,
    xml        TEXT NOT NULL,
    built_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sitemap_cache_category_page ON sitemap_cache (category, page);

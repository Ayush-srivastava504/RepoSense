-- State for scripts/push_route_sitemaps.py (daily-pipeline stage 'index:routes').
-- One row per URL last seen in a route sitemap (static, hackathons, tools, blog, skills, companies, locations,
-- batches, resume, careers) that has been pushed to IndexNow. The script submits URLs that are new, whose
-- <lastmod> changed, or that disappeared from the sitemap (a removal notice), then updates this table.
CREATE TABLE IF NOT EXISTS route_sitemap_urls (
    url               TEXT PRIMARY KEY,
    sitemap_slug      TEXT NOT NULL,                 -- sitemap_categories.slug the URL came from
    lastmod           TEXT,                          -- raw <lastmod> from the sitemap, NULL if it has none
    first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_submitted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_route_sitemap_urls_slug ON route_sitemap_urls (sitemap_slug);

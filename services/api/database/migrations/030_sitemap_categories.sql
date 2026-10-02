-- Registry of everything that appears in the sitemap index.
--   kind='job_cache': a job category built into sitemap_cache by scripts/build_sitemaps.py.
--                     slug = URL prefix on the site (/jobs/..., /government-jobs/...);
--                     job_rule = which jobs land in it (precedence: government > internship > remote > default).
--   kind='route'    : a standalone sitemap served by a Next.js route at `path`.
-- Toggle `enabled` (or reorder) with an UPDATE -- no deploy needed; the next hourly build and the
-- hourly-cached sitemap index pick it up.
CREATE TABLE IF NOT EXISTS sitemap_categories (
    slug       TEXT PRIMARY KEY,
    kind       TEXT NOT NULL CHECK (kind IN ('job_cache', 'route')),
    job_rule   TEXT CHECK (job_rule IN ('government', 'internship', 'remote', 'default')),
    path       TEXT,
    enabled    BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 100,
    notes      TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT sitemap_categories_shape_chk CHECK (
        (kind = 'job_cache' AND job_rule IS NOT NULL AND path IS NULL) OR
        (kind = 'route' AND path IS NOT NULL AND job_rule IS NULL)
    )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sitemap_categories_job_rule
    ON sitemap_categories (job_rule) WHERE job_rule IS NOT NULL;

INSERT INTO sitemap_categories (slug, kind, job_rule, path, sort_order, notes) VALUES
    ('static',          'route',     NULL,         '/sitemap-static.xml',      10,  'core pages'),
    ('jobs',            'job_cache', 'default',    NULL,                       20,  NULL),
    ('internships',     'job_cache', 'internship', NULL,                       21,  NULL),
    ('remote-jobs',     'job_cache', 'remote',     NULL,                       22,  NULL),
    ('government-jobs', 'job_cache', 'government', NULL,                       23,  'tech/PSU ranked above general notices (quality.py)'),
    ('hackathons',      'route',     NULL,         '/sitemap-hackathons.xml',  30,  NULL),
    ('tools',           'route',     NULL,         '/sitemap-tools.xml',       40,  NULL),
    ('blog',            'route',     NULL,         '/sitemap-blog.xml',        50,  NULL),
    ('skills',          'route',     NULL,         '/sitemap-skills.xml',      60,  NULL),
    ('companies',       'route',     NULL,         '/sitemap-companies.xml',   70,  NULL),
    ('locations',       'route',     NULL,         '/sitemap-locations.xml',   80,  NULL),
    ('batches',         'route',     NULL,         '/sitemap-batches.xml',     90,  NULL),
    ('resume',          'route',     NULL,         '/sitemap-resume.xml',      100, NULL),
    ('careers',         'route',     NULL,         '/sitemap-careers.xml',     110, NULL)
ON CONFLICT (slug) DO NOTHING;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT      PRIMARY KEY,
    title       TEXT      NOT NULL,
    company     TEXT      NOT NULL,
    description TEXT,
    url         TEXT      UNIQUE,
    source      TEXT,
    location    TEXT,
    salary      TEXT,
    stipend     TEXT,
    type        TEXT,
    posted_at   TIMESTAMP,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active   BOOLEAN   DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_jobs_source        ON jobs (source);
CREATE INDEX IF NOT EXISTS idx_jobs_company       ON jobs (company);
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at     ON jobs (posted_at);
CREATE INDEX IF NOT EXISTS idx_jobs_location      ON jobs (location);
CREATE INDEX IF NOT EXISTS idx_jobs_active_posted ON jobs (is_active, posted_at DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm       ON jobs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm     ON jobs USING gin (company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_description_trgm ON jobs USING gin (description gin_trgm_ops);
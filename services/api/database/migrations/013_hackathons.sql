-- Hackathon discovery feature. Deliberately a SEPARATE table from `jobs`:
-- hackathons have their own lifecycle (upcoming -> ongoing -> ended /
-- registration_closed) and their own quality-scoring rules, so mixing them
-- into the jobs table would make both harder to reason about.
--
-- Design mirrors the jobs table's conventions (TEXT id from a content hash,
-- upsert-by-url, is_active-style filtering) so the crawler/API code stays
-- consistent with the rest of the codebase.

CREATE TABLE IF NOT EXISTS hackathons (
    id                      TEXT        PRIMARY KEY,

    title                   TEXT        NOT NULL,
    slug                    TEXT        NOT NULL UNIQUE,

    organizer               TEXT,
    description             TEXT,

    participation_mode      TEXT,       -- 'online' | 'offline' | 'hybrid'
    location                TEXT,
    country                 TEXT,
    is_global               BOOLEAN     DEFAULT FALSE,
    is_student_friendly     BOOLEAN     DEFAULT FALSE,

    start_date              TIMESTAMP,
    end_date                TIMESTAMP,
    registration_deadline   TIMESTAMP,

    prize_pool_text         TEXT,
    prize_value_usd         NUMERIC,

    team_size_min           INTEGER,
    team_size_max           INTEGER,

    eligibility             TEXT,
    themes                  JSONB       DEFAULT '[]',
    submission_requirements JSONB       DEFAULT '[]',

    source                  TEXT        NOT NULL,
    sources                 JSONB       DEFAULT '[]',   -- all sources this listing was seen on, after dedupe
    source_url              TEXT        NOT NULL,
    apply_url               TEXT,
    image_url               TEXT,

    status                  TEXT        DEFAULT 'upcoming',  -- upcoming | ongoing | ended | registration_closed
    quality_score           INTEGER     DEFAULT 0,
    trust_score             INTEGER     DEFAULT 0,

    source_hash             TEXT,

    first_seen_at           TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    last_seen_at            TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    created_at              TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,

    is_active                BOOLEAN    DEFAULT TRUE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hackathons_source_url ON hackathons (source_url);

CREATE INDEX IF NOT EXISTS idx_hackathons_status              ON hackathons (status);
CREATE INDEX IF NOT EXISTS idx_hackathons_deadline            ON hackathons (registration_deadline);
CREATE INDEX IF NOT EXISTS idx_hackathons_start_date          ON hackathons (start_date);
CREATE INDEX IF NOT EXISTS idx_hackathons_country              ON hackathons (country);
CREATE INDEX IF NOT EXISTS idx_hackathons_quality             ON hackathons (quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_hackathons_active_status_score
    ON hackathons (is_active, status, quality_score DESC, registration_deadline);
CREATE INDEX IF NOT EXISTS idx_hackathons_themes              ON hackathons USING GIN (themes);

COMMENT ON COLUMN hackathons.quality_score IS
    'Deterministic 0-100 score from crawler/src/processors/hackathon_quality.py; listings below 60 are not written.';
COMMENT ON COLUMN hackathons.status IS
    'Computed daily by hackathon_status.determine_status(); upcoming/ongoing are the only statuses the public API returns by default.';
COMMENT ON COLUMN hackathons.sources IS
    'All source scrapers this listing was seen on before dedupe collapsed duplicates into one row.';

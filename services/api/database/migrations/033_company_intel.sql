-- Company intelligence: one row per employer (entity), the pages crawled from its own
-- website (sources), and the AI-written topic sections grounded in those pages (topics).
-- Written only by services/company_intel/ (separate from the job crawler); read by
-- GET /api/companies/by-slug/{slug} and /api/companies/intel/sitemap.

CREATE TABLE IF NOT EXISTS company_entities (
    id               BIGSERIAL PRIMARY KEY,
    slug             TEXT NOT NULL UNIQUE,
    name             TEXT NOT NULL,
    name_key         TEXT NOT NULL UNIQUE,          -- lower(name) with non-alphanumerics removed
    official_domain  TEXT,                          -- verified employer domain, never a job board / ATS
    domain_source    TEXT,                          -- 'jobs' | 'manual'
    logo_domain      TEXT,
    status           TEXT NOT NULL DEFAULT 'pending', -- pending | active | skipped | blocked
    status_reason    TEXT,
    last_crawled_at  TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_company_entities_status ON company_entities (status, last_crawled_at);

CREATE TABLE IF NOT EXISTS company_sources (
    id            BIGSERIAL PRIMARY KEY,
    entity_id     BIGINT NOT NULL REFERENCES company_entities(id) ON DELETE CASCADE,
    url           TEXT NOT NULL,
    topic_hint    TEXT NOT NULL,                    -- topic key the page was found for
    title         TEXT,
    text          TEXT NOT NULL,
    content_hash  TEXT NOT NULL,
    fetched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_id, url)
);
CREATE INDEX IF NOT EXISTS idx_company_sources_entity ON company_sources (entity_id, topic_hint);

CREATE TABLE IF NOT EXISTS company_topics (
    id             BIGSERIAL PRIMARY KEY,
    entity_id      BIGINT NOT NULL REFERENCES company_entities(id) ON DELETE CASCADE,
    topic_key      TEXT NOT NULL,
    title          TEXT NOT NULL,
    body           TEXT,
    bullets        JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_urls    TEXT[] NOT NULL DEFAULT '{}',
    source_hash    TEXT NOT NULL,                   -- hash of the inputs; unchanged inputs are not re-enriched
    model          TEXT,
    status         TEXT NOT NULL,                   -- published | rejected | stale
    reject_reason  TEXT,
    enriched_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (entity_id, topic_key)
);
CREATE INDEX IF NOT EXISTS idx_company_topics_entity_status ON company_topics (entity_id, status);

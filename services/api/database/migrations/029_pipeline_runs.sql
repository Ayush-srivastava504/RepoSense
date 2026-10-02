-- Central log of every stage of the crawl -> enrich -> sitemap -> index loop.
-- Written by scripts/pipeline_stage.py (workflow stages) and the crawler
-- (stage='crawl'). One row per stage execution; run_id groups a daily chain.
CREATE TABLE IF NOT EXISTS pipeline_runs (
    id          BIGSERIAL PRIMARY KEY,
    run_id      TEXT NOT NULL,                 -- GitHub run id for chained runs, 'crawler-<ts>' for crawls
    stage       TEXT NOT NULL,                 -- crawl | enrich | sitemap | index:<category> | gone
    status      TEXT NOT NULL,                 -- running | ok | failed
    started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ,
    duration_s  NUMERIC(10,1),
    detail      JSONB,                         -- counts / output tail / error
    CONSTRAINT pipeline_runs_status_chk CHECK (status IN ('running', 'ok', 'failed'))
);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_stage_started ON pipeline_runs (stage, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_runs_run_id ON pipeline_runs (run_id);

-- Nightly aggregates behind the shared charts (scripts/build_chart_stats.py, daily-pipeline stage 'charts').
--   chart_key 'segment:<segment_key>'  one row per jobs.segment_key (content_layer.segment_key) with enough listings
--   chart_key 'topic:<slug>'           editorial topics (e.g. topic:machine-learning-engineer) used by blog charts
-- stats JSONB holds percentages computed from real listings only: skills_pct, experience_pct, work_mode_pct,
-- top_locations, plus the denominators (experience_known, work_mode_known). Segments/topics with too few
-- listings are not stored at all, so a page never shows a chart built on a handful of jobs.
CREATE TABLE IF NOT EXISTS chart_stats (
    chart_key   TEXT PRIMARY KEY,
    kind        TEXT NOT NULL CHECK (kind IN ('segment', 'topic')),
    sample_size INTEGER NOT NULL,
    stats       JSONB NOT NULL,
    computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_chart_stats_kind_sample ON chart_stats (kind, sample_size DESC);

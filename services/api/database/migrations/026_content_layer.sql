-- Migration 026: content layer columns
--
-- WHY: crawler/src/processors/content_layer.py's attach_content_plan()
-- computes content_tier ('full' / 'standard' / 'table_only'),
-- content_table (structured facts, no LLM), content_faq (slot-filled
-- Q&A, only for 'full'/'standard' tier), and segment_key (which shared
-- nightly-aggregated chart a job's page points at) -- gated on the
-- legitimacy_state/is_thin signals quality.py's filter_and_score()
-- already produces, so LLM spend tracks confidence rather than raw
-- crawl volume. None of these columns existed yet, so wiring
-- attach_content_plan() into index.py's pipeline without this migration
-- would compute the plan and then silently drop it in upsert_jobs().
--
-- content_table/content_faq are jsonb (each a list of small dicts, see
-- content_layer.py's build_table()/build_faq() shapes) rather than
-- separate normalized tables: they're read as a unit per job-page
-- render, never queried/filtered on individually.

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_tier TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_table JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS content_faq JSONB;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS segment_key TEXT;

-- Nightly chart aggregation (segment_stats.py, not yet built per
-- FIXES_APPLIED.md) will group by this column, and job pages will look
-- up their chart by it -- index it now so that join is cheap once it
-- exists, rather than adding it as an afterthought migration later.
CREATE INDEX IF NOT EXISTS idx_jobs_segment_key ON jobs (segment_key);

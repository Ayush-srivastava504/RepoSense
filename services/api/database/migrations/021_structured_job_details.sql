-- Structured job-detail fields, ported from FresherFlow's EnrichedJobPayload
-- schema (packages/pipeline/src/core/enricher-schema.ts). Previously
-- RepoSense only stored a single enriched_overview paragraph + a flat
-- enriched_keywords tag list — no Education/Requirements/Key Skills/Notes
-- breakdown like FresherFlow's job detail page shows.
--
-- These are additive and nullable: existing rows are untouched until the
-- next enrichment pass fills them in. content_enrichment.py now writes
-- them alongside enriched_overview/enriched_keywords.

ALTER TABLE jobs
    ADD COLUMN IF NOT EXISTS allowed_degrees TEXT[],
    ADD COLUMN IF NOT EXISTS allowed_courses TEXT[],
    ADD COLUMN IF NOT EXISTS allowed_specializations TEXT[],
    ADD COLUMN IF NOT EXISTS allowed_passout_years INTEGER[],
    ADD COLUMN IF NOT EXISTS required_skills TEXT[],
    ADD COLUMN IF NOT EXISTS notes_highlights TEXT,
    ADD COLUMN IF NOT EXISTS work_mode TEXT,
    ADD COLUMN IF NOT EXISTS experience_min INTEGER,
    ADD COLUMN IF NOT EXISTS experience_max INTEGER,
    ADD COLUMN IF NOT EXISTS job_function TEXT,
    ADD COLUMN IF NOT EXISTS structured_description TEXT;

COMMENT ON COLUMN jobs.allowed_degrees IS
    'Enum-ish array e.g. {DIPLOMA,DEGREE,PG} — extracted by content_enrichment.py, mirrors FresherFlow EducationLevel enum.';
COMMENT ON COLUMN jobs.allowed_courses IS
    'Course names e.g. {B.Tech,B.E,MCA} extracted from the description.';
COMMENT ON COLUMN jobs.allowed_specializations IS
    'Branch/specialization names e.g. {Computer Science,Electronics}.';
COMMENT ON COLUMN jobs.allowed_passout_years IS
    'Eligible graduation years e.g. {2025,2026}. Empty array if not mentioned.';
COMMENT ON COLUMN jobs.required_skills IS
    'Technical skills/tools/frameworks mentioned in the posting — renders as the "Key Skills" pill row.';
COMMENT ON COLUMN jobs.notes_highlights IS
    'Short callouts only (shift timing, bond/service agreement, joining deadline) — renders as the "Notes" box. Kept intentionally brief; not a second description field.';
COMMENT ON COLUMN jobs.work_mode IS
    'ONSITE | REMOTE | HYBRID — best-effort extraction, may be NULL if undeterminable.';
COMMENT ON COLUMN jobs.experience_min IS 'Years, 0 for fresher/entry-level roles.';
COMMENT ON COLUMN jobs.experience_max IS 'Years.';
COMMENT ON COLUMN jobs.job_function IS 'Free-text role family, e.g. "Manufacturing Operations", "Software Development".';
COMMENT ON COLUMN jobs.structured_description IS
    'Reformatted description with plain-text section headers (About the Role / Responsibilities / Requirements / Eligibility), no markdown. NULL until enrichment has run for this job — frontend should fall back to the raw description column when NULL.';

CREATE INDEX IF NOT EXISTS idx_jobs_required_skills ON jobs USING GIN (required_skills);
CREATE INDEX IF NOT EXISTS idx_jobs_allowed_passout_years ON jobs USING GIN (allowed_passout_years);

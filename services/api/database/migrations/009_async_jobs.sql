-- Async job queue for long-running LLM tasks (README generation, resume generation).
-- These can take 200+ seconds, which exceeds Cloudflare's ~100s proxy timeout.
-- Pattern: POST returns a job_id immediately; client polls GET /api/jobs/{job_id}.

CREATE TABLE async_jobs (
    id          TEXT PRIMARY KEY,                   -- random UUID, returned to client
    user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
    type        TEXT NOT NULL,                      -- 'readme' | 'resume'
    status      TEXT NOT NULL DEFAULT 'pending',    -- pending | running | done | failed
    payload     JSONB NOT NULL DEFAULT '{}',        -- input params stored for the worker
    result      JSONB,                              -- output once done (readme text, pdf_path, etc.)
    error       TEXT,                               -- human-readable error if status = failed
    created_at  TIMESTAMP DEFAULT NOW(),
    updated_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_async_jobs_user_id   ON async_jobs(user_id);
CREATE INDEX idx_async_jobs_status    ON async_jobs(status);
CREATE INDEX idx_async_jobs_created   ON async_jobs(created_at);
-- LinkedIn Profile Optimizer (premium feature)
-- Checks a profile against 14 optimization rules, scores it, and uses the
-- same on-prem Qwen3 model (NEURAL_GENERATOR_URL) to generate suggestions.
--
-- Access model:
--   - Pro / Enterprise subscribers -> unlimited analyses.
--   - Free users -> FREE_LIFETIME_LIMIT free analyses (see linkedin_service.py),
--     after that they must either upgrade or watch a rewarded ad to get a
--     single-use "unlock credit" stored in linkedin_ad_credits.

CREATE TABLE linkedin_analyses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id) ON DELETE CASCADE,
    score           INT NOT NULL,
    rule_results    JSONB NOT NULL,           -- the 14 rule pass/fail + suggestions
    ai_feedback     JSONB,                    -- qwen3-generated overall feedback / rewrites
    unlock_method   TEXT NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'ad'
    created_at      TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_linkedin_analyses_user_id  ON linkedin_analyses(user_id);
CREATE INDEX idx_linkedin_analyses_created  ON linkedin_analyses(created_at);

-- One row per user. `credits` is incremented every time the user finishes
-- watching a rewarded ad, and decremented by 1 every time it's spent on an
-- analysis. This keeps the gate enforceable server-side instead of trusting
-- the client.
CREATE TABLE linkedin_ad_credits (
    user_id     UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    credits     INT NOT NULL DEFAULT 0,
    updated_at  TIMESTAMP DEFAULT NOW()
);

-- migrations/008_otp_auth.sql
--
-- Migrates from password-based auth to email OTP.
-- Run this once against your PostgreSQL database.
--
-- BEFORE running: make sure all existing users have been notified
-- that their password will be removed and they will log in via email OTP.

BEGIN;

-- 1. Drop the password column — no longer needed
ALTER TABLE users
    DROP COLUMN IF EXISTS password_hash;

-- 2. Ensure the email column has a unique constraint
--    (should already exist, but make sure)
ALTER TABLE users
    ADD CONSTRAINT users_email_unique UNIQUE (email)
    ON CONFLICT DO NOTHING;  -- Postgres: use IF NOT EXISTS pattern instead if needed

-- 3. Make subscription_tier default to 'free' if not already
ALTER TABLE users
    ALTER COLUMN subscription_tier SET DEFAULT 'free';

-- OTPs are stored in Redis (not the DB), so no table changes needed for them.

COMMIT;
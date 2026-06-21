BEGIN;

-- Drop password column
ALTER TABLE users
    DROP COLUMN IF EXISTS password_hash;

-- subscription tier default
ALTER TABLE users
    ALTER COLUMN subscription_tier SET DEFAULT 'free';

COMMIT;
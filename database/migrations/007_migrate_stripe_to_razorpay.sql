-- Migration: Replace Stripe with Razorpay for subscriptions
-- This migration updates the subscriptions table to use Razorpay payment gateway

-- Add Razorpay-specific columns
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS razorpay_order_id TEXT,
ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'pro';

-- Add UNIQUE constraint on razorpay_order_id to prevent duplicates
ALTER TABLE subscriptions
ADD CONSTRAINT unique_razorpay_order_id UNIQUE(razorpay_order_id) DEFERRABLE INITIALLY DEFERRED;

-- Drop Stripe-specific columns (optional: comment out if you want to keep historical data)
-- ALTER TABLE subscriptions
-- DROP COLUMN IF EXISTS stripe_customer_id,
-- DROP COLUMN IF EXISTS stripe_subscription_id;

-- Create index on razorpay_order_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_order_id 
ON subscriptions(razorpay_order_id);

-- Create index on razorpay_payment_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_payment_id 
ON subscriptions(razorpay_payment_id);

-- Ensure user_id has a unique constraint for subscriptions (one subscription per user)
ALTER TABLE subscriptions
ADD CONSTRAINT unique_user_subscription UNIQUE(user_id) DEFERRABLE INITIALLY DEFERRED;

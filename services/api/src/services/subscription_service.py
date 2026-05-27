from datetime import datetime
from configs.db import get_db_pool


class SubscriptionService:
    """Service for managing user subscriptions and plan limits.
    
    Provides functionality to retrieve subscription status, check feature
    limits based on the user's plan tier, and manage subscription expirations.
    Supports three tiers: free, pro, and enterprise with different feature limits.
    """

    TIER_LIMITS = {
        "free":       {"reviews_per_day": 5,   "repos": 1,  "resume_exports": 1},
        "pro":        {"reviews_per_day": 100,  "repos": 10, "resume_exports": 20},
        "enterprise": {"reviews_per_day": 9999, "repos": 999,"resume_exports": 999},
    }

    async def get_user_subscription(self, user_id: str) -> dict:
        """Retrieve subscription status for a user.
        
        Fetches the user's current subscription tier and status from the database.
        If the subscription is marked as active but the period has ended, automatically
        transitions it to expired and downgrades the user back to free tier.
        
        Args:
            user_id: UUID of the user.
            
        Returns:
            Dictionary with 'tier', 'status', and optionally 'period_end' keys.
            Default is 'free' tier with 'none' status if no subscription exists.
        """
        pool = await get_db_pool()
        if pool is None:
            return {"tier": "free", "status": "none"}

        row = await pool.fetchrow(
            """
            SELECT u.subscription_tier, s.status, s.current_period_end
            FROM users u
            LEFT JOIN subscriptions s ON s.user_id = u.id
            WHERE u.id = $1
            """,
            user_id,
        )

        if not row:
            return {"tier": "free", "status": "none"}

        if (
            row["status"] == "active"
            and row["current_period_end"]
            and row["current_period_end"] < datetime.utcnow()
        ):
            await pool.execute(
                "UPDATE subscriptions SET status = 'expired' WHERE user_id = $1",
                user_id,
            )
            await pool.execute(
                "UPDATE users SET subscription_tier = 'free' WHERE id = $1",
                user_id,
            )
            return {"tier": "free", "status": "expired"}

        return {
            "tier":   row["subscription_tier"],
            "status": row["status"] or "none",
            "period_end": row["current_period_end"],
        }

    async def check_limit(self, user_id: str, feature: str) -> bool:
        """Check if user has access to a feature based on their plan.
        
        Verifies whether the given feature is available in the user's current
        subscription tier. Can be extended to track actual usage and enforce
        per-day limits.
        
        Args:
            user_id: UUID of the user.
            feature: Feature name to check (e.g., 'reviews_per_day', 'repos').
            
        Returns:
            True if feature is available in user's tier, False otherwise.
        """
        sub = await self.get_user_subscription(user_id)
        tier = sub.get("tier", "free")
        limits = self.TIER_LIMITS.get(tier, self.TIER_LIMITS["free"])
        return feature in limits

    async def get_tier_limits(self, tier: str) -> dict:
        """Get feature limits for a specific subscription tier.
        
        Returns the limit dictionary for the given tier, or defaults to free tier
        limits if the tier is not recognized.
        
        Args:
            tier: Subscription tier name ('free', 'pro', 'enterprise').
            
        Returns:
            Dictionary mapping feature names to their limits.
        """
        return self.TIER_LIMITS.get(tier, self.TIER_LIMITS["free"])

# Module: src/services/subscription_service.py
# Defines class(es): SubscriptionService
#
#

from datetime import datetime
from configs.db import get_db_pool

class SubscriptionService:
    TIER_LIMITS = {'free': {'reviews_per_day': 5, 'repos': 1, 'resume_exports': 1}, 'pro': {'reviews_per_day': 100, 'repos': 10, 'resume_exports': 20}, 'enterprise': {'reviews_per_day': 9999, 'repos': 999, 'resume_exports': 999}}

    async def get_user_subscription(self, user_id: str) -> dict:
        pool = await get_db_pool()
        if pool is None:
            return {'tier': 'free', 'status': 'none'}
        row = await pool.fetchrow('\n            SELECT u.subscription_tier, s.status, s.current_period_end\n            FROM users u\n            LEFT JOIN subscriptions s ON s.user_id = u.id\n            WHERE u.id = $1\n            ', user_id)
        if not row:
            return {'tier': 'free', 'status': 'none'}
        if row['status'] == 'active' and row['current_period_end'] and (row['current_period_end'] < datetime.utcnow()):
            await pool.execute("UPDATE subscriptions SET status = 'expired' WHERE user_id = $1", user_id)
            await pool.execute("UPDATE users SET subscription_tier = 'free' WHERE id = $1", user_id)
            return {'tier': 'free', 'status': 'expired'}
        return {'tier': row['subscription_tier'], 'status': row['status'] or 'none', 'period_end': row['current_period_end']}

    async def check_limit(self, user_id: str, feature: str) -> bool:
        sub = await self.get_user_subscription(user_id)
        tier = sub.get('tier', 'free')
        limits = self.TIER_LIMITS.get(tier, self.TIER_LIMITS['free'])
        return feature in limits

    async def get_tier_limits(self, tier: str) -> dict:
        return self.TIER_LIMITS.get(tier, self.TIER_LIMITS['free'])

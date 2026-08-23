# services/api/src/services/linkedin_service.py
# Access control + persistence for the LinkedIn Profile Optimizer premium
# feature. Mirrors subscription_service.py's idea of "tier" but adds a second,
# non-cash unlock path: watching a rewarded ad.

from __future__ import annotations
from typing import Optional
FREE_LIFETIME_LIMIT = 1

class LinkedInService:

    def __init__(self, pool):
        self.pool = pool

    async def get_status(self, user_id: str, tier: str) -> dict:
        is_pro = tier in ('pro', 'enterprise')
        free_used = await self.pool.fetchval("SELECT COUNT(*) FROM linkedin_analyses WHERE user_id = $1 AND unlock_method = 'free'", user_id) or 0
        credit_row = await self.pool.fetchrow('SELECT credits FROM linkedin_ad_credits WHERE user_id = $1', user_id)
        ad_credits = credit_row['credits'] if credit_row else 0
        free_remaining = max(0, FREE_LIFETIME_LIMIT - free_used)
        can_analyze = is_pro or free_remaining > 0 or ad_credits > 0
        return {'tier': tier, 'is_pro': is_pro, 'free_limit': FREE_LIFETIME_LIMIT, 'free_used': free_used, 'free_remaining': free_remaining, 'ad_credits': ad_credits, 'can_analyze': can_analyze}

    async def grant_ad_credit(self, user_id: str) -> int:
        row = await self.pool.fetchrow('\n            INSERT INTO linkedin_ad_credits (user_id, credits)\n            VALUES ($1, 1)\n            ON CONFLICT (user_id) DO UPDATE SET\n                credits = linkedin_ad_credits.credits + 1,\n                updated_at = NOW()\n            RETURNING credits\n            ', user_id)
        return row['credits']

    async def reserve_access(self, user_id: str, tier: str) -> Optional[str]:
        if tier in ('pro', 'enterprise'):
            return 'pro'
        free_used = await self.pool.fetchval("SELECT COUNT(*) FROM linkedin_analyses WHERE user_id = $1 AND unlock_method = 'free'", user_id) or 0
        if free_used < FREE_LIFETIME_LIMIT:
            return 'free'
        async with self.pool.acquire() as conn:
            async with conn.transaction():
                row = await conn.fetchrow('SELECT credits FROM linkedin_ad_credits WHERE user_id = $1 FOR UPDATE', user_id)
                if row and row['credits'] > 0:
                    await conn.execute('UPDATE linkedin_ad_credits SET credits = credits - 1, updated_at = NOW() WHERE user_id = $1', user_id)
                    return 'ad'
        return None

    async def save_analysis(self, user_id: str, unlock_method: str, rule_report: dict, ai_feedback: dict) -> str:
        import json
        row = await self.pool.fetchrow('\n            INSERT INTO linkedin_analyses (user_id, score, rule_results, ai_feedback, unlock_method)\n            VALUES ($1, $2, $3, $4, $5)\n            RETURNING id\n            ', user_id, rule_report['score'], json.dumps(rule_report), json.dumps(ai_feedback), unlock_method)
        return str(row['id'])

    async def get_history(self, user_id: str, limit: int=20) -> list:
        rows = await self.pool.fetch('\n            SELECT id, score, unlock_method, created_at\n            FROM linkedin_analyses\n            WHERE user_id = $1\n            ORDER BY created_at DESC\n            LIMIT $2\n            ', user_id, limit)
        return [{'id': str(r['id']), 'score': r['score'], 'unlock_method': r['unlock_method'], 'created_at': r['created_at'].isoformat() if r['created_at'] else None} for r in rows]

from configs.db import get_db_pool

class JobsService:
    async def get_recent_jobs(self, limit: int, offset: int):
        pool = await get_db_pool()
        rows = await pool.fetch(
            "SELECT id, title, company, description, url, source, posted_at FROM jobs WHERE is_active = true ORDER BY posted_at DESC LIMIT $1 OFFSET $2",
            limit, offset
        )
        return [dict(r) for r in rows]
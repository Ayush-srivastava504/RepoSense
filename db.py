import asyncpg
from .settings import settings

_pool = None

async def get_db_pool():
    global _pool
    if _pool is None:
        _pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=5)
    return _pool
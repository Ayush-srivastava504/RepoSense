# Module: src/configs/db.py
# Defines function(s): get_db_pool, close_db_pool
#
#

import asyncpg
from .config import settings
_pool = None

async def get_db_pool():
    global _pool
    if _pool is not None:
        return _pool
    try:
        try:
            _pool = await asyncpg.create_pool(settings.DATABASE_URL, min_size=1, max_size=10, command_timeout=60)
        except OSError as dns_err:
            import urllib.parse
            parsed = urllib.parse.urlparse(settings.DATABASE_URL)
            netloc = f'{parsed.username}:{parsed.password}@localhost:{parsed.port}'
            fallback_url = parsed._replace(netloc=netloc).geturl()
            print(f'[WARN] DB hostname resolution failed ({dns_err}); retrying with localhost')
            _pool = await asyncpg.create_pool(fallback_url, min_size=1, max_size=10, command_timeout=60)
        print('[DB] Connection pool created')
    except Exception as exc:
        print(f'[WARN] DB connect failed: {exc}')
        _pool = None
    return _pool

async def close_db_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None

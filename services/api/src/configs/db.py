import asyncpg
from .config import settings

_pool = None

async def get_db_pool():
    """Create and return a singleton asyncpg connection pool.

    In development environments the PostgreSQL server might not be running.
    To prevent the entire application from crashing during startup we catch
    connection errors, log a warning and return ``None``. Callers should handle a
    ``None`` return value appropriately (e.g., by returning a 503 response or
    using a mock implementation).
    """
    global _pool
    if _pool is None:
        try:
            _pool = await asyncpg.create_pool(
                settings.DATABASE_URL, min_size=1, max_size=5
            )
        except Exception as exc:  # pragma: no cover
            # Log the error; using print for simplicity as logger may not be
            # configured at import time.
            print(f"[WARN] Failed to create asyncpg pool: {exc}")
            _pool = None
    return _pool
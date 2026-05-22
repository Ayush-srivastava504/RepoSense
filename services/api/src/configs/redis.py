import redis.asyncio as redis
from .config import settings

_redis = None

async def get_redis():
    """Create and return a singleton Redis client.

    If the Redis server is unavailable we log a warning and return ``None`` so
    the application can continue to start in a degraded mode.
    """
    global _redis
    if _redis is None:
        try:
            _redis = await redis.from_url(
                settings.REDIS_URL, decode_responses=True
            )
        except Exception as exc:  # pragma: no cover
                print(f"[WARN] Failed to connect to Redis: {exc}")
                _redis = None
    return _redis
import redis.asyncio as aioredis
from .config import settings

_redis = None

async def get_redis():
    """Create and return a singleton Redis client.
    
    Attempts to establish a Redis connection on first call. If the connection
    fails or Redis is not configured, logs a warning and returns None, allowing
    the application to operate in degraded mode. On subsequent calls, verifies
    the connection is still alive and reconnects if needed.
    
    This pattern handles containerized deployments where Redis may not be
    immediately available at startup and where connections can be lost during
    operation. Callers should handle None returns gracefully.
    
    Returns:
        aioredis.Redis client if available, None if Redis is unavailable.
    """
    global _redis
    if _redis is not None:
        try:
            await _redis.ping()
            return _redis
        except Exception:
            _redis = None

    if not settings.REDIS_URL:
        return None

    try:
        _redis = aioredis.from_url(
            settings.REDIS_URL,
            decode_responses=True,
            socket_connect_timeout=5,
        )
        await _redis.ping()
        print("[Redis] Connected")
    except Exception as exc:
        print(f"[WARN] Redis connect failed: {exc}")
        _redis = None
    return _redis
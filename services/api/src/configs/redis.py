# Module: src/configs/redis.py
# Defines function(s): get_redis
#
#

import redis.asyncio as aioredis
from .config import settings
_redis = None

async def get_redis():
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
        _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True, socket_connect_timeout=5)
        await _redis.ping()
        print('[Redis] Connected')
    except OSError as dns_err:
        import urllib.parse
        parsed = urllib.parse.urlparse(settings.REDIS_URL)
        netloc = f'{parsed.username}:{parsed.password}@localhost:{parsed.port}'
        fallback_url = parsed._replace(netloc=netloc).geturl()
        print(f'[WARN] Redis hostname resolution failed ({dns_err}); retrying with localhost')
        try:
            _redis = aioredis.from_url(fallback_url, decode_responses=True, socket_connect_timeout=5)
            await _redis.ping()
            print('[Redis] Connected (fallback)')
        except Exception as exc:
            print(f'[WARN] Redis connect failed after fallback: {exc}')
            _redis = None
    except Exception as exc:
        print(f'[WARN] Redis connect failed: {exc}')
        _redis = None
    return _redis

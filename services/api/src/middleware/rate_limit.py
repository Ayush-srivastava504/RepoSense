from fastapi import Request, HTTPException
from configs.redis import get_redis

async def rate_limit_middleware(request: Request, call_next):
    # Try to obtain a Redis client. If the connection failed (``get_redis``
    # returns ``None``) we simply skip rate‑limiting – the request can still be
    # processed, but no abuse protection will be applied.
    redis = await get_redis()
    if redis is None:
        return await call_next(request)

    user = getattr(request.state, "user", None)
    if user and user.get("id"):
        client_id = f"user:{user['id']}"
        limit = 200
    else:
        ip = request.headers.get("X-Forwarded-For", request.client.host)
        client_id = f"ip:{ip}"
        limit = 50

    key = f"rate:{client_id}"
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, 60)
    if current > limit:
        raise HTTPException(429, "Rate limit exceeded")
    return await call_next(request)
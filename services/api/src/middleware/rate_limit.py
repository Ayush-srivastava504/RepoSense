import hmac

from fastapi import Request
from fastapi.responses import JSONResponse

from configs.config import settings
from configs.redis import get_redis


def _load_test_bypass(request: Request) -> bool:
    """True only when a valid load-test key is presented.

    The bypass is opt-in on both sides: it does nothing unless an operator
    has set LOAD_TEST_BYPASS_KEY, and even then a request must present the
    exact matching X-Load-Test-Key header. hmac.compare_digest avoids
    leaking the key via a timing side-channel.
    """
    configured_key = settings.LOAD_TEST_BYPASS_KEY
    if not configured_key:
        return False

    provided_key = request.headers.get("X-Load-Test-Key", "")
    if not provided_key:
        return False

    return hmac.compare_digest(provided_key, configured_key)


def get_client_ip(request: Request) -> str:
    """Best-effort real client IP when the app sits behind Cloudflare
    and/or another reverse proxy.

    Precedence:
    1. CF-Connecting-IP - set by Cloudflare itself from its own view of the
       TCP connection, so it can't be spoofed by a client sending its own
       copy of the header (Cloudflare overwrites it at the edge).
    2. True-Client-IP - same guarantee, set on Cloudflare Enterprise plans.
    3. X-Forwarded-For - may contain a client-supplied chain
       ("client, proxy1, proxy2, ..."); the *leftmost* entry is the
       original client as recorded by the first proxy hop, so we take that
       rather than the raw header or the last entry.
    4. request.client.host - direct connection, no proxy in front.
    """
    cf_connecting_ip = request.headers.get("CF-Connecting-IP")
    if cf_connecting_ip:
        return cf_connecting_ip.strip()

    true_client_ip = request.headers.get("True-Client-IP")
    if true_client_ip:
        return true_client_ip.strip()

    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        first_hop = forwarded_for.split(",")[0].strip()
        if first_hop:
            return first_hop

    return request.client.host if request.client else "unknown"


async def rate_limit_middleware(request: Request, call_next):
    # Preflight requests carry no credentials and no business payload —
    # blocking one doesn't protect anything, it just breaks the real
    # request that follows it (browsers won't even send that request if
    # the preflight comes back without proper CORS headers).
    if request.method == "OPTIONS":
        return await call_next(request)

    # Try to obtain a Redis client. If the connection failed (``get_redis``
    # returns ``None``) we simply skip rate-limiting - the request can still
    # be processed, but no abuse protection will be applied.
    redis = await get_redis()
    if redis is None:
        return await call_next(request)

    if _load_test_bypass(request):
        return await call_next(request)

    user = getattr(request.state, "user", None)
    if user and user.get("id"):
        client_id = f"user:{user['id']}"
        limit = 200
    else:
        ip = get_client_ip(request)
        client_id = f"ip:{ip}"
        limit = 50

    key = f"rate:{client_id}"
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, 60)

    if current > limit:
        retry_after = await redis.ttl(key)
        return JSONResponse(
            status_code=429,
            content={"detail": "Rate limit exceeded"},
            headers={"Retry-After": str(max(retry_after, 1))},
        )

    return await call_next(request)

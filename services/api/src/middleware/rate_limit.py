# Module: src/middleware/rate_limit.py
# Defines function(s): _load_test_bypass, get_client_ip, rate_limit_middleware
#
#

import hmac
from fastapi import Request
from fastapi.responses import JSONResponse
from configs.config import settings
from configs.redis import get_redis

def _load_test_bypass(request: Request) -> bool:
    configured_key = settings.LOAD_TEST_BYPASS_KEY
    if not configured_key:
        return False
    provided_key = request.headers.get('X-Load-Test-Key', '')
    if not provided_key:
        return False
    return hmac.compare_digest(provided_key, configured_key)

def get_client_ip(request: Request) -> str:
    cf_connecting_ip = request.headers.get('CF-Connecting-IP')
    if cf_connecting_ip:
        return cf_connecting_ip.strip()
    true_client_ip = request.headers.get('True-Client-IP')
    if true_client_ip:
        return true_client_ip.strip()
    forwarded_for = request.headers.get('X-Forwarded-For')
    if forwarded_for:
        first_hop = forwarded_for.split(',')[0].strip()
        if first_hop:
            return first_hop
    return request.client.host if request.client else 'unknown'

async def rate_limit_middleware(request: Request, call_next):
    if request.method == 'OPTIONS':
        return await call_next(request)
    redis = await get_redis()
    if redis is None:
        return await call_next(request)
    if _load_test_bypass(request):
        return await call_next(request)
    user = getattr(request.state, 'user', None)
    if user and user.get('id'):
        client_id = f'user:{user["id"]}'
        limit = 200
    else:
        ip = get_client_ip(request)
        client_id = f'ip:{ip}'
        limit = 50
    key = f'rate:{client_id}'
    current = await redis.incr(key)
    if current == 1:
        await redis.expire(key, 60)
    if current > limit:
        retry_after = await redis.ttl(key)
        return JSONResponse(status_code=429, content={'detail': 'Rate limit exceeded'}, headers={'Retry-After': str(max(retry_after, 1))})
    return await call_next(request)

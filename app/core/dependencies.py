from fastapi import Request, HTTPException, status
from functools import lru_cache
from app.utils.logger import setup_logger
from configs.config import settings
from ml.model.model_loader import ModelLoader
import time
from collections import defaultdict

logger = setup_logger(__name__)

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
    
    def check_rate_limit(self, client_id: str) -> bool:
        now = time.time()
        window_start = now - settings.security.RATE_LIMIT_PERIOD
        
        self.requests[client_id] = [
            req_time for req_time in self.requests[client_id] 
            if req_time > window_start
        ]
        
        if len(self.requests[client_id]) >= settings.security.RATE_LIMIT_REQUESTS:
            return False
        
        self.requests[client_id].append(now)
        return True

rate_limiter = RateLimiter()

@lru_cache(maxsize=1)
def get_model_loader() -> ModelLoader:
    return ModelLoader()

async def verify_api_key(request: Request) -> bool:
    if not settings.security.API_KEY_ENABLED:
        return True
    
    api_key = request.headers.get("X-API-Key")
    if not api_key or api_key != settings.security.API_KEY:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key"
        )
    return True

async def check_rate_limit(request: Request) -> bool:
    client_ip = request.client.host
    if not rate_limiter.check_rate_limit(client_ip):
        from app.core.exceptions import RateLimitExceeded
        raise RateLimitExceeded()
    return True
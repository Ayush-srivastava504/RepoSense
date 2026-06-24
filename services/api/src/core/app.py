from contextlib import asynccontextmanager
import time
import json
import uuid

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware

from configs.config import settings
from configs.db import get_db_pool
from configs.redis import get_redis

from middleware.rate_limit import rate_limit_middleware

from utils.logger import setup_logger

from routes import (
    auth,
    github,
    resume,
    jobs,
    subscription,
    webhooks,
)
from routes.async_jobs import router as async_jobs_router

from api.routes import router as review_router
from api.routes_self_healing import router as self_healing_router

logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting API in development mode")

    await get_db_pool()
    redis_conn = await get_redis()

    from services.ai_service import AIService
    AIService()
    logger.info("AI service ready")

    if redis_conn:
        from datetime import datetime
        await redis_conn.set("app:start_time", datetime.utcnow().isoformat())
        await redis_conn.incr("app:restart_count")
        await redis_conn.expire("app:start_time", 90)

    yield

    pool = await get_db_pool()
    if pool is not None:
        await pool.close()

    if redis_conn is not None:
        await redis_conn.close()

    logger.info("Shutdown complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title="Internship Platform API (with AI Review & Self-Healing)",
        description="Backend with code review, GitHub integration, resumes, jobs",
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Middleware ────────────────────────────────────────────────────────────

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"],
    )

    app.middleware("http")(rate_limit_middleware)

    @app.middleware("http")
    async def request_logging_middleware(request: Request, call_next):
        req_id = str(uuid.uuid4())[:8]
        logger.info(json.dumps({
            "event":  "request",
            "id":     req_id,
            "method": request.method,
            "path":   request.url.path,
            "ip":     request.headers.get(
                "X-Forwarded-For",
                request.client.host if request.client else "unknown",
            ),
        }))
        start    = time.time()
        response = await call_next(request)
        ms       = round((time.time() - start) * 1000, 1)
        logger.info(json.dumps({
            "event":  "response",
            "id":     req_id,
            "status": response.status_code,
            "ms":     ms,
        }))
        return response

    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start    = time.monotonic()
        response = await call_next(request)
        response.headers["X-Process-Time"] = str(time.monotonic() - start)
        return response

    # ── Routers ───────────────────────────────────────────────────────────────

    app.include_router(auth.router)
    app.include_router(github.router)
    app.include_router(resume.router)
    app.include_router(jobs.router)
    app.include_router(subscription.router)
    app.include_router(webhooks.router)
    app.include_router(async_jobs_router)   # /api/async-jobs/{id}
    app.include_router(review_router)       # /api/v1/review + /api/v1/fix
    app.include_router(self_healing_router)

    # ── Core endpoints ────────────────────────────────────────────────────────

    @app.get("/", tags=["meta"])
    async def root():
        return {
            "service": "Internship Platform API",
            "version": "2.0.0",
            "status":  "operational",
            "docs":    "/docs",
        }

    @app.get("/health", tags=["meta"])
    async def health():
        return {"status": "ok"}

    @app.get("/health/detailed", tags=["meta"])
    async def health_detailed():
        status: dict = {"api": "ok", "db": "unknown", "redis": "unknown"}

        pool = await get_db_pool()
        if pool:
            try:
                await pool.fetchval("SELECT 1")
                status["db"] = "ok"
            except Exception:
                status["db"] = "error"
        else:
            status["db"] = "disconnected"

        redis = await get_redis()
        if redis:
            try:
                await redis.ping()
                status["redis"] = "ok"
            except Exception:
                status["redis"] = "error"
        else:
            status["redis"] = "disconnected"

        overall = "ok" if all(v == "ok" for v in status.values()) else "degraded"
        return {"status": overall, "services": status}

    return app


app = create_application()
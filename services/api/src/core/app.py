from contextlib import asynccontextmanager
import time

from fastapi import FastAPI
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

from api.routes import router as review_router
from api.routes_self_healing import (
    router as self_healing_router,
)


logger = setup_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(
        "Starting API in development mode"
    )

    await get_db_pool()
    await get_redis()

    from services.ai_service import AIService

    AIService()

    logger.info("AI service ready")

    yield

    pool = await get_db_pool()

    if pool is not None:
        await pool.close()

    redis_conn = await get_redis()

    if redis_conn is not None:
        await redis_conn.close()

    logger.info("Shutdown complete")


def create_application() -> FastAPI:
    app = FastAPI(
        title=(
            "Internship Platform API "
            "(with AI Review & Self-Healing)"
        ),
        description=(
            "Backend with code review, "
            "GitHub integration, resumes, jobs"
        ),
        version="2.0.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

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

    app.middleware("http")(
        rate_limit_middleware
    )

    @app.middleware("http")
    async def add_process_time_header(
        request,
        call_next,
    ):
        start = time.time()

        response = await call_next(request)

        response.headers[
            "X-Process-Time"
        ] = str(time.time() - start)

        return response

    app.include_router(auth.router)
    app.include_router(github.router)
    app.include_router(resume.router)
    app.include_router(jobs.router)
    app.include_router(subscription.router)
    app.include_router(webhooks.router)

    app.include_router(review_router)

    app.include_router(
        self_healing_router
    )

    @app.get("/")
    async def root():
        return {
            "service": (
                "Internship Platform API"
            ),
            "version": "2.0.0",
            "status": "operational",
            "docs": "/docs",
        }

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    return app


app = create_application()
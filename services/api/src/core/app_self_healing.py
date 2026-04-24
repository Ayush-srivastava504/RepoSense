from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import router
from app.api.routes_self_healing import router as self_healing_router
from app.core.exceptions import CodeReviewerException
from app.utils.logger import setup_logger
from configs.config import settings
import time

logger = setup_logger(__name__)

def create_application() -> FastAPI:
    app = FastAPI(
        title="AI Code Reviewer with Self-Healing",
        description="Production-grade code review system with auto-fix capabilities",
        version="1.0.0",
        docs_url="/docs" if not settings.is_production else None,
        redoc_url="/redoc" if not settings.is_production else None
    )
    
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    app.include_router(router)
    app.include_router(self_healing_router)
    
    @app.on_event("startup")
    async def startup_event():
        logger.info(f"Starting AI Code Reviewer with Self-Healing in {settings.api.ENVIRONMENT} mode")
        if settings.is_production:
            from app.services.review_service import ReviewService
            service = ReviewService()
            service._ensure_engine()
    
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down AI Code Reviewer")
    
    return app

app = create_application()
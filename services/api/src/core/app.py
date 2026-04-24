from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from app.api.routes import router
from app.api.routes_self_healing import router as self_healing_router
from app.utils.logger import setup_logger
from configs.config import settings
import time
import os

logger = setup_logger(__name__)

def create_application() -> FastAPI:
    app = FastAPI(
        title="AI Code Reviewer",
        description="Production-grade code review system with self-healing",
        version="1.0.0",
        docs_url="/docs",
        redoc_url="/redoc"
    )
    
    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.api.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Trusted host middleware for security
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["*"] if settings.is_production else ["*"]
    )
    
    # Request timing middleware
    @app.middleware("http")
    async def add_process_time_header(request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response
    
    # Include routers
    app.include_router(router)
    app.include_router(self_healing_router)
    
    # Root endpoint
    @app.get("/")
    async def root():
        return {
            "service": "AI Code Reviewer",
            "version": "1.0.0",
            "status": "operational",
            "docs": "/docs"
        }
    
    @app.on_event("startup")
    async def startup_event():
        logger.info(f"Starting AI Code Reviewer in {settings.api.ENVIRONMENT} mode")
        logger.info(f"Model: {settings.model.MODEL_NAME}")
        logger.info(f"Device: {settings.model.DEVICE}")
        
        # Pre-load model in production
        if settings.is_production:
            try:
                from app.services.review_service import ReviewService
                service = ReviewService()
                service._ensure_engine()
                logger.info("Model pre-loaded successfully")
            except Exception as e:
                logger.error(f"Failed to pre-load model: {e}")
    
    @app.on_event("shutdown")
    async def shutdown_event():
        logger.info("Shutting down AI Code Reviewer")
    
    return app

app = create_application()
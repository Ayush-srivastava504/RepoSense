from fastapi import APIRouter, Depends, BackgroundTasks
from app.schemas.models import (
    ReviewRequest, ReviewResponse, BatchReviewRequest, 
    BatchReviewResponse, HealthResponse, InfoResponse
)
from app.services.review_service import ReviewService
from app.core.dependencies import verify_api_key, check_rate_limit, get_model_loader
from app.utils.logger import setup_logger
from configs.config import settings
import torch
import time
from ml.model.model_loader import ModelLoader

logger = setup_logger(__name__)
router = APIRouter(prefix="/api/v1", tags=["review"])

review_service = ReviewService()
start_time = time.time()

@router.post("/review", response_model=ReviewResponse)
async def review_code(
    request: ReviewRequest,
    authenticated: bool = Depends(verify_api_key),
    rate_limited: bool = Depends(check_rate_limit)
):
    return await review_service.review_single(request)

@router.post("/batch-review", response_model=BatchReviewResponse)
async def batch_review_code(
    request: BatchReviewRequest,
    authenticated: bool = Depends(verify_api_key),
    rate_limited: bool = Depends(check_rate_limit)
):
    result = await review_service.review_batch(request.requests)
    return BatchReviewResponse(**result)

@router.get("/health", response_model=HealthResponse)
async def health_check(loader: ModelLoader = Depends(get_model_loader)):
    uptime = time.time() - start_time

    return HealthResponse(
        status="healthy" if loader.is_loaded else "degraded",
        version="1.0.0",
        model_loaded=loader.is_loaded,
        gpu_available=torch.cuda.is_available(),
        uptime_seconds=round(uptime, 2)
    )

@router.get("/info", response_model=InfoResponse)
async def service_info():
    return InfoResponse(
        service_name="AI Code Reviewer",
        version="1.0.0",
        supported_languages=["python", "javascript", "typescript", "java", "go", "rust"],
        features=["bug_detection", "code_quality", "readability_analysis", "security_scanning"],
        max_code_length=settings.preprocessing.MAX_CODE_LENGTH
    )

@router.get("/supported-languages")
async def supported_languages():
    return {
        "languages": ["python", "javascript", "typescript", "java", "go", "rust"]
    }

@router.post("/validate-code")
async def validate_code(request: ReviewRequest):
    return {
        "valid": True,
        "length": len(request.code),
        "lines": len(request.code.split('\n'))
    }

@router.post("/load-model")
async def load_model(background_tasks: BackgroundTasks):
    background_tasks.add_task(review_service._ensure_engine)
    return {"status": "model_loading_initiated"}
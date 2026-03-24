from pydantic import BaseModel, Field, validator
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime

class Language(str, Enum):
    PYTHON = "python"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    JAVA = "java"
    GO = "go"
    RUST = "rust"

class Severity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"
    INFO = "info"

class Issue(BaseModel):
    line: Optional[int]
    column: Optional[int]
    severity: Severity
    category: str
    message: str
    suggestion: str
    confidence: float = Field(ge=0, le=1)

class QualityMetrics(BaseModel):
    complexity_score: float
    maintainability_index: float
    duplication_rate: float
    comment_ratio: float
    lines_of_code: int

class ReviewRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=100000)
    language: Language
    include_metrics: bool = True
    focus_areas: Optional[List[str]] = None
    
    @validator('code')
    def validate_code_length(cls, v):
        if len(v) > 100000:
            raise ValueError('Code exceeds maximum length of 100000 characters')
        return v

class ReviewResponse(BaseModel):
    request_id: str
    code_length: int
    issues_found: int
    issues: List[Issue]
    quality_metrics: Optional[QualityMetrics]
    summary: str
    processing_time_ms: float
    model_version: str

class BatchReviewRequest(BaseModel):
    requests: List[ReviewRequest]

class BatchReviewResponse(BaseModel):
    total_items: int
    successful: int
    failed: int
    results: List[ReviewResponse]
    errors: List[Dict[str, Any]]

class HealthResponse(BaseModel):
    status: str
    version: str
    model_loaded: bool
    gpu_available: bool
    uptime_seconds: float

class InfoResponse(BaseModel):
    service_name: str
    version: str
    supported_languages: List[str]
    features: List[str]
    max_code_length: int
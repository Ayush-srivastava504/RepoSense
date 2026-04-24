import time
import asyncio
from typing import List, Dict, Any
from app.schemas.models import ReviewRequest, ReviewResponse, Issue, QualityMetrics, Severity
from app.core.dependencies import get_model_loader
from app.utils.logger import setup_logger
from ml.preprocessing.code_preprocessor import CodePreprocessor
from ml.inference.analysis_engine import CodeAnalysisEngine
from ml.inference.postprocessor import Postprocessor
from configs.config import settings
import uuid

logger = setup_logger(__name__)

class ReviewService:
    def __init__(self):
        self.model_loader = get_model_loader()
        self.preprocessor = CodePreprocessor()
        self.postprocessor = Postprocessor()
        self.analysis_engine = None
    
    def _ensure_engine(self):
        if self.analysis_engine is None:
            model, tokenizer = self.model_loader.get_model()
            device = self.model_loader.device
            self.analysis_engine = CodeAnalysisEngine(model, tokenizer, device)
    
    async def review_single(self, request: ReviewRequest) -> ReviewResponse:
        start_time = time.time()
        request_id = str(uuid.uuid4())[:8]
        
        try:
            self._ensure_engine()
            
            code_length = len(request.code.split('\n'))
            
            loop = asyncio.get_event_loop()
            raw_issues = await loop.run_in_executor(
                None,
                self.analysis_engine.analyze,
                request.code,
                request.language.value,
                request.focus_areas
            )
            
            processed = self.postprocessor.process(raw_issues, code_length)
            
            issues = [
                Issue(
                    line=issue.get('line'),
                    column=issue.get('column'),
                    severity=Severity(issue['severity']),
                    category=issue['category'],
                    message=issue['message'],
                    suggestion=issue['suggestion'],
                    confidence=issue['confidence']
                )
                for issue in processed['issues']
            ]
            
            quality_metrics = None
            if request.include_metrics:
                quality_metrics = QualityMetrics(**processed['quality_metrics'])
            
            processing_time = (time.time() - start_time) * 1000
            
            return ReviewResponse(
                request_id=request_id,
                code_length=code_length,
                issues_found=len(issues),
                issues=issues,
                quality_metrics=quality_metrics,
                summary=processed['summary'],
                processing_time_ms=round(processing_time, 2),
                model_version=settings.model.MODEL_NAME
            )
            
        except Exception as e:
            logger.error(f"Review failed for {request_id}: {e}")
            raise
    
    async def review_batch(self, requests: List[ReviewRequest]) -> Dict[str, Any]:
        tasks = [self.review_single(req) for req in requests]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        successful = []
        failed = []
        
        for result in results:
            if isinstance(result, Exception):
                failed.append({'error': str(result)})
            else:
                successful.append(result)
        
        return {
            'total_items': len(requests),
            'successful': len(successful),
            'failed': len(failed),
            'results': successful,
            'errors': failed
        }
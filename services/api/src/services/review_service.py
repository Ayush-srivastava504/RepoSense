# services/review_service.py

import time
import asyncio
import uuid
from typing import List, Dict, Any, Optional

from src.schemas.models import ReviewRequest, ReviewResponse, Issue, QualityMetrics, Severity
from src.core.dependencies import get_model_loader
from src.utils.logger import setup_logger
from services.api.src.services.postprocessor import Postprocessor
from services.api.src.services.analysis_engine import CodeAnalysisEngine
from services.api.src.services.postprocessor import Postprocessor
from configs.config import settings

logger = setup_logger(__name__)

_BATCH_CONCURRENCY = 5  # max parallel reviews


class ReviewService:
    """
    Orchestrates single and batch code reviews.

    The analysis engine is initialised lazily on first use so the service
    can be constructed cheaply (e.g. during DI container setup).
    """

    def __init__(self) -> None:
        self._model_loader  = get_model_loader()
        self._preprocessor  = CodePreprocessor()
        self._postprocessor = Postprocessor()
        self._engine: Optional[CodeAnalysisEngine] = None
        self._engine_lock = asyncio.Lock()

    # ── Engine lifecycle ──────────────────────────────────────────────────────

    async def _get_engine(self) -> CodeAnalysisEngine:
        """Thread-safe lazy initialisation of the analysis engine."""
        if self._engine is not None:
            return self._engine
        async with self._engine_lock:
            # Double-checked locking: another coroutine may have initialised
            if self._engine is None:
                model, tokenizer = await asyncio.to_thread(self._model_loader.get_model)
                self._engine = CodeAnalysisEngine(model, tokenizer, self._model_loader.device)
                logger.info("Analysis engine initialised (model=%s)", settings.model.MODEL_NAME)
        return self._engine

    # ── Public API ────────────────────────────────────────────────────────────

    async def review_single(self, request: ReviewRequest) -> ReviewResponse:
        request_id = uuid.uuid4().hex[:8]
        start_ms   = time.monotonic()

        logger.info("review_single start id=%s lang=%s", request_id, request.language.value)

        engine     = await self._get_engine()
        code_lines = request.code.splitlines()
        code_length = len(code_lines)

        raw_issues: List[Dict[str, Any]] = await asyncio.to_thread(
            engine.analyze,
            request.code,
            request.language.value,
            request.focus_areas,
        )

        processed = self._postprocessor.process(raw_issues, code_length)

        issues = self._build_issues(processed["issues"])
        quality_metrics = (
            QualityMetrics(**processed["quality_metrics"]) if request.include_metrics else None
        )

        elapsed_ms = round((time.monotonic() - start_ms) * 1000, 2)
        logger.info("review_single done id=%s issues=%d ms=%s", request_id, len(issues), elapsed_ms)

        return ReviewResponse(
            request_id=request_id,
            code_length=code_length,
            issues_found=len(issues),
            issues=issues,
            quality_metrics=quality_metrics,
            summary=processed["summary"],
            processing_time_ms=elapsed_ms,
            model_version=settings.model.MODEL_NAME,
        )

    async def review_batch(
        self,
        requests: List[ReviewRequest],
        concurrency: int = _BATCH_CONCURRENCY,
    ) -> Dict[str, Any]:
        """
        Review multiple files concurrently, bounded by *concurrency* semaphore.
        Never raises — failed items are captured in 'errors'.
        """
        semaphore = asyncio.Semaphore(concurrency)

        async def _guarded(req: ReviewRequest) -> ReviewResponse:
            async with semaphore:
                return await self.review_single(req)

        results = await asyncio.gather(
            *(_guarded(r) for r in requests),
            return_exceptions=True,
        )

        successful: List[ReviewResponse] = []
        failed: List[Dict[str, str]]     = []

        for idx, result in enumerate(results):
            if isinstance(result, BaseException):
                logger.error("Batch item %d failed: %s", idx, result)
                failed.append({"index": idx, "error": str(result)})
            else:
                successful.append(result)

        return {
            "total_items":  len(requests),
            "successful":   len(successful),
            "failed":       len(failed),
            "results":      successful,
            "errors":       failed,
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _build_issues(raw: List[Dict[str, Any]]) -> List[Issue]:
        issues = []
        for item in raw:
            try:
                issues.append(Issue(
                    line=item.get("line"),
                    column=item.get("col"),
                    severity=Severity(item["severity"]),
                    category=item["category"],
                    message=item["message"],
                    suggestion=item["suggestion"],
                    confidence=item["confidence"],
                ))
            except (KeyError, ValueError) as exc:
                logger.warning("Skipping malformed issue: %s — %s", item, exc)
        return issues
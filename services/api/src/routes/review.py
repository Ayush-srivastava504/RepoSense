# routes/review.py
import asyncio

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from middleware.auth import verify_token
from services.api.src.services.analysis_engine import CodeAnalysisEngine
from services.api.src.services.postprocessor import Postprocessor
from services.api.src.services.code_preprocessor import CodePreprocessor
from services.api.src.services.auto_fixer import AutoFixer

router = APIRouter(prefix="/api/v1", tags=["review"])

_preprocessor  = CodePreprocessor()
_postprocessor = Postprocessor()
_fixer         = AutoFixer()

# Guardrails added 2026-06-25 alongside the analysis_engine ReDoS fix.
# These protect the worker even if a future rule reintroduces a slow pattern,
# or someone submits a pathologically large payload.
MAX_CODE_BYTES   = 200_000   # ~200 KB of source per request
ANALYSIS_TIMEOUT = 10        # seconds


# ── Schemas ───────────────────────────────────────────────────────────────────
class ReviewRequest(BaseModel):
    code: str
    language: str = "python"
    focus_areas: Optional[List[str]] = None
    include_metrics: bool = True


class FixRequest(BaseModel):
    code: str
    language: str = "python"
    issues: List[Dict[str, Any]]        # pass issues straight from /review response
    dry_run: bool = False


# ── Endpoints ─────────────────────────────────────────────────────────────────
@router.post("/review")
async def review_code(body: ReviewRequest, user=Depends(verify_token)):
    from app.core.dependencies import get_model_loader

    code_size = len(body.code.encode("utf-8"))
    if code_size > MAX_CODE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Code payload too large ({code_size} bytes); "
                    f"limit is {MAX_CODE_BYTES} bytes.",
        )

    code   = _preprocessor.preprocess(body.code, body.language)
    lines  = _preprocessor.line_count(code)
    loader = get_model_loader()
    model, tokenizer = loader.get_model()
    engine = CodeAnalysisEngine(model, tokenizer, loader.device)

    try:
        raw_issues = await asyncio.wait_for(
            asyncio.to_thread(
                engine.analyze, code, body.language, body.focus_areas
            ),
            timeout=ANALYSIS_TIMEOUT,
        )
    except asyncio.TimeoutError:
        raise HTTPException(
            status_code=504,
            detail="Code analysis timed out. Try submitting a smaller file "
                    "or narrowing focus_areas.",
        )

    processed = _postprocessor.process(raw_issues, lines)
    return processed                     # includes issues, quality_metrics, summary


@router.post("/fix")
async def fix_code(body: FixRequest, user=Depends(verify_token)):
    """
    Accepts the code + issues array returned by /review and applies
    safe automated fixes.  Returns fixed_code + a per-fix changelog.
    """
    code_size = len(body.code.encode("utf-8"))
    if code_size > MAX_CODE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Code payload too large ({code_size} bytes); "
                    f"limit is {MAX_CODE_BYTES} bytes.",
        )

    result = _fixer.auto_fix(
        code=body.code,
        issues=body.issues,
        language=body.language,
        dry_run=body.dry_run,
    )
    return result.to_dict()
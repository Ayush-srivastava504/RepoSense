# Module: src/routes/review.py
# Defines class(es): ReviewRequest, FixRequest
# Defines function(s): review_code, fix_code
#

import asyncio
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from middleware.auth import verify_token
from services.api.src.services.analysis_engine import CodeAnalysisEngine
from services.api.src.services.postprocessor import Postprocessor
from services.api.src.services.code_preprocessor import CodePreprocessor
from services.api.src.services.auto_fixer import AutoFixer
router = APIRouter(prefix='/api/v1', tags=['review'])
_preprocessor = CodePreprocessor()
_postprocessor = Postprocessor()
_fixer = AutoFixer()
MAX_CODE_BYTES = 200000
ANALYSIS_TIMEOUT = 10

class ReviewRequest(BaseModel):
    code: str
    language: str = 'python'
    focus_areas: Optional[List[str]] = None
    include_metrics: bool = True

class FixRequest(BaseModel):
    code: str
    language: str = 'python'
    issues: List[Dict[str, Any]]
    dry_run: bool = False

@router.post('/review')
async def review_code(body: ReviewRequest, user=Depends(verify_token)):
    from app.core.dependencies import get_model_loader
    code_size = len(body.code.encode('utf-8'))
    if code_size > MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail=f'Code payload too large ({code_size} bytes); limit is {MAX_CODE_BYTES} bytes.')
    code = _preprocessor.preprocess(body.code, body.language)
    lines = _preprocessor.line_count(code)
    loader = get_model_loader()
    model, tokenizer = loader.get_model()
    engine = CodeAnalysisEngine(model, tokenizer, loader.device)
    try:
        raw_issues = await asyncio.wait_for(asyncio.to_thread(engine.analyze, code, body.language, body.focus_areas), timeout=ANALYSIS_TIMEOUT)
    except asyncio.TimeoutError:
        raise HTTPException(status_code=504, detail='Code analysis timed out. Try submitting a smaller file or narrowing focus_areas.')
    processed = _postprocessor.process(raw_issues, lines)
    return processed

@router.post('/fix')
async def fix_code(body: FixRequest, user=Depends(verify_token)):
    code_size = len(body.code.encode('utf-8'))
    if code_size > MAX_CODE_BYTES:
        raise HTTPException(status_code=413, detail=f'Code payload too large ({code_size} bytes); limit is {MAX_CODE_BYTES} bytes.')
    result = _fixer.auto_fix(code=body.code, issues=body.issues, language=body.language, dry_run=body.dry_run)
    return result.to_dict()

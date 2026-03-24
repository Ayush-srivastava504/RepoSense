from fastapi import APIRouter, Depends, BackgroundTasks
from typing import List, Optional
from pydantic import BaseModel
from app.schemas.models import ReviewRequest
from app.services.review_service import ReviewService
from app.core.dependencies import verify_api_key, check_rate_limit
from ml.inference.auto_fixer import AutoFixer
from ml.inference.validation_engine import ValidationEngine, ValidationResult
from app.utils.logger import setup_logger

logger = setup_logger(__name__)
router = APIRouter(prefix="/api/v1/self-healing", tags=["self-healing"])

class FixRequest(BaseModel):
    code: str
    language: str
    auto_validate: bool = True
    max_fix_iterations: int = 3

class FixResponse(BaseModel):
    original_code: str
    fixed_code: Optional[str]
    applied_fixes: List[dict]
    validation_result: Optional[ValidationResult]
    iterations: int
    success: bool
    error_message: Optional[str] = None

class ValidationRequest(BaseModel):
    code: str
    language: str
    run_tests: bool = False

class ValidationResponse(BaseModel):
    passed: bool
    errors: List[str]
    warnings: List[str]
    execution_time: Optional[float] = None

review_service = ReviewService()
auto_fixer = AutoFixer()
validation_engine = ValidationEngine()

@router.post("/fix", response_model=FixResponse)
async def auto_fix_code(
    request: FixRequest,
    authenticated: bool = Depends(verify_api_key),
    rate_limited: bool = Depends(check_rate_limit)
):
    current_code = request.code
    all_fixes = []
    iterations = 0
    
    try:
        review_result = await review_service.review_single(
            ReviewRequest(
                code=current_code,
                language=request.language,
                include_metrics=False
            )
        )
        
        issues = [issue.dict() for issue in review_result.issues]
        
        if not issues:
            return FixResponse(
                original_code=request.code,
                fixed_code=None,
                applied_fixes=[],
                validation_result=None,
                iterations=0,
                success=False,
                error_message=None
            )
        
        fix_result = auto_fixer.auto_fix(current_code, issues, request.language)
        
        if not fix_result.success or not fix_result.fixed_code:
            return FixResponse(
                original_code=request.code,
                fixed_code=None,
                applied_fixes=[],
                validation_result=None,
                iterations=0,
                success=False,
                error_message="No fixes applied"
            )
        
        all_fixes.extend(fix_result.applied_fixes)
        current_code = fix_result.fixed_code
        iterations = 1
        
        validation_result = None
        if request.auto_validate:
            validation_result = validation_engine.validate(current_code, request.language)
        
        return FixResponse(
            original_code=request.code,
            fixed_code=current_code,
            applied_fixes=all_fixes,
            validation_result=validation_result,
            iterations=iterations,
            success=True,
            error_message=None
        )
    
    except Exception as e:
        logger.error(f"Auto-fix failed: {e}")
        return FixResponse(
            original_code=request.code,
            fixed_code=None,
            applied_fixes=all_fixes,
            validation_result=None,
            iterations=iterations,
            success=False,
            error_message=str(e)
        )

@router.post("/validate", response_model=ValidationResponse)
async def validate_code(
    request: ValidationRequest,
    authenticated: bool = Depends(verify_api_key),
    rate_limited: bool = Depends(check_rate_limit)
):
    result = validation_engine.validate(
        request.code,
        request.language,
        request.run_tests
    )
    
    return ValidationResponse(
        passed=result.passed,
        errors=result.errors,
        warnings=result.warnings,
        execution_time=result.execution_time
    )

@router.post("/fix-and-validate")
async def fix_and_validate(
    request: FixRequest,
    background_tasks: BackgroundTasks
):
    fix_response = await auto_fix_code(request)
    
    if fix_response.success and fix_response.fixed_code:
        validation = validation_engine.validate(
            fix_response.fixed_code,
            request.language,
            run_tests=True
        )
        
        if validation.passed:
            background_tasks.add_task(
                logger.info,
                f"Successfully fixed and validated code: {len(fix_response.applied_fixes)} fixes applied"
            )
            
            return {
                "status": "success",
                "fixes_applied": fix_response.applied_fixes,
                "final_code": fix_response.fixed_code,
                "validation": validation.__dict__
            }
    
    return {
        "status": "failed",
        "fixes_applied": fix_response.applied_fixes,
        "error": "Could not produce valid code after fixes"
    }
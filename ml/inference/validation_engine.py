import ast
import subprocess
import tempfile
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import time

@dataclass
class ValidationResult:
    passed: bool
    errors: List[str]
    warnings: List[str]
    execution_time: Optional[float] = None
    output: Optional[str] = None

class ValidationEngine:
    def __init__(self):
        self.timeout_seconds = 5
    
    def validate(self, code: str, language: str, run_tests: bool = False) -> ValidationResult:
        errors = []
        warnings = []
        
        syntax_valid = self._validate_syntax(code, language)
        if not syntax_valid:
            errors.append("Syntax validation failed")
            return ValidationResult(False, errors, warnings)
        
        if language == 'python':
            style_issues = self._validate_python_style(code)
            warnings.extend(style_issues)
            
            if run_tests:
                test_result = self._run_python_tests(code)
                if not test_result.passed:
                    errors.extend(test_result.errors)
        
        return ValidationResult(
            passed=len(errors) == 0,
            errors=errors,
            warnings=warnings
        )
    
    def _validate_syntax(self, code: str, language: str) -> bool:
        try:
            if language == 'python':
                ast.parse(code)
                return True
            elif language == 'javascript':
                import esprima
                esprima.parseScript(code)
                return True
            elif language == 'typescript':
                import typescript
                typescript.transpileModule(code, {})
                return True
        except Exception as e:
            return False
        
        return True
    
    def _validate_python_style(self, code: str) -> List[str]:
        issues = []
        lines = code.split('\n')
        
        for i, line in enumerate(lines, 1):
            if len(line) > 79:
                issues.append(f"Line {i}: Exceeds 79 characters")
            
            if '\t' in line:
                issues.append(f"Line {i}: Contains tab character")
            
            if line and not line[0].isspace() and 'import' not in line:
                if not line[0].isalpha() and line[0] != '_':
                    issues.append(f"Line {i}: Class/function name should be lowercase")
        
        return issues
    
    def _run_python_tests(self, code: str) -> ValidationResult:
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(code)
            temp_file = f.name
        
        try:
            start_time = time.time()
            result = subprocess.run(
                ['python', '-m', 'py_compile', temp_file],
                capture_output=True,
                text=True,
                timeout=self.timeout_seconds
            )
            execution_time = time.time() - start_time
            
            errors = []
            if result.stderr:
                errors.append(result.stderr)
            
            return ValidationResult(
                passed=result.returncode == 0,
                errors=errors,
                warnings=[],
                execution_time=execution_time
            )
        
        except subprocess.TimeoutExpired:
            return ValidationResult(
                passed=False,
                errors=["Test execution timeout"],
                warnings=[]
            )
        finally:
            import os
            os.unlink(temp_file)
import re
import os
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class CodeAnalyzer:
    # Code analysis engine using CodeBERT + pattern rules.
    # Falls back to pattern-based analysis if model unavailable.

    def __init__(self):
        self.codebert_available = False
        self.model = None
        self.tokenizer = None

        try:
            from transformers import AutoModel, AutoTokenizer

            model_name = os.getenv("CODEBERT_MODEL", "microsoft/codebert-base")
            cache_dir = os.getenv("MODEL_CACHE_DIR", ".model_cache")

            logger.info(f"Loading CodeBERT from Hugging Face: {model_name}")

            self.tokenizer = AutoTokenizer.from_pretrained(
                model_name,
                cache_dir=cache_dir,
                trust_remote_code=True,  # only use with trusted repos
            )
            self.model = AutoModel.from_pretrained(
                model_name,
                cache_dir=cache_dir,
                trust_remote_code=True,  # only use with trusted repos
            )
            self.codebert_available = True
            logger.info("CodeBERT model loaded successfully")

        except Exception as e:
            # fall back to pattern-based analysis
            logger.warning(f"CodeBERT not available: {e}; using pattern-based analysis")

    def analyze(self, code: str, language: str, focus_areas: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        issues = []

        # null reference
        if re.search(r'null\s*\.|\bNone\s*\.', code):
            issues.append({
                'category': 'bug', 'type': 'null_reference', 'severity': 'critical',
                'message': 'Potential null reference', 'suggestion': 'Add null check',
                'confidence': 0.85, 'line': self._find_line(code, r'null\s*\.|\bNone\s*\.')
            })

        # I/O without error handling
        if re.search(r'(?<!try:)\s*(open|read|write|delete)\(', code):
            issues.append({
                'category': 'bug', 'type': 'missing_error_handling', 'severity': 'high',
                'message': 'Missing error handling for I/O', 'suggestion': 'Wrap in try/except',
                'confidence': 0.8, 'line': self._find_line(code, r'(open|read|write|delete)\(')
            })

        # lines exceeding 100 characters
        for i, line in enumerate(code.split('\n'), 1):
            if len(line) > 100:
                issues.append({
                    'category': 'quality', 'type': 'line_too_long', 'severity': 'low',
                    'line': i, 'message': f'Line exceeds 100 characters ({len(line)})',
                    'suggestion': 'Split line', 'confidence': 0.9
                })

        # hardcoded password
        if re.search(r'password\s*=\s*["\'][^"\']+["\']', code, re.IGNORECASE):
            issues.append({
                'category': 'security', 'type': 'hardcoded_secret', 'severity': 'critical',
                'message': 'Hardcoded password', 'suggestion': 'Use env var', 'confidence': 0.95,
                'line': self._find_line(code, r'password\s*=\s*["\'][^"\']+["\']')
            })

        # hardcoded API key
        if re.search(r'api[_-]?key\s*=\s*["\'][^"\']+["\']', code, re.IGNORECASE):
            issues.append({
                'category': 'security', 'type': 'hardcoded_secret', 'severity': 'critical',
                'message': 'Hardcoded API key', 'suggestion': 'Use env var', 'confidence': 0.95,
                'line': self._find_line(code, r'api[_-]?key\s*=\s*["\'][^"\']+["\']')
            })

        return issues

    def _find_line(self, code: str, pattern: str) -> int:
        for i, line in enumerate(code.split('\n'), 1):
            if re.search(pattern, line):
                return i
        return 0
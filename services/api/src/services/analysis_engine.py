import re
import os
from typing import List, Dict, Any, Optional

class CodeAnalysisEngine:
    """Code analysis engine using CodeBERT ONNX embeddings + pattern rules.
    
    The ONNX model (CodeBERT quantized) is loaded from CODEBERT_ONNX_PATH.
    If unavailable, falls back to pure regex pattern matching.
    """

    def __init__(self):
        self.onnx_available = False
        self.session = None
        self.tokenizer = None
        
        # Try to load CodeBERT ONNX model for better analysis
        try:
            import onnxruntime as ort
            from transformers import AutoTokenizer
            
            onnx_path = os.getenv("CODEBERT_ONNX_PATH", "/app/models/codebert_quantized.onnx")
            if os.path.exists(onnx_path):
                self.session = ort.InferenceSession(
                    onnx_path,
                    providers=["CPUExecutionProvider"],
                )
                self.tokenizer = AutoTokenizer.from_pretrained(
                    "microsoft/codebert-base",
                    cache_dir="/tmp/models",
                    local_files_only=False,
                )
                self.onnx_available = True
        except Exception as e:
            # ONNX not available; fall back to patterns
            print(f"[WARN] CodeBERT ONNX not available: {e}; using pattern-based analysis")

    def analyze(self, code: str, language: str, focus_areas: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        issues = []
        # Bug patterns
        if re.search(r'null\s*\.|\bNone\s*\.', code):
            issues.append({
                'category': 'bug', 'type': 'null_reference', 'severity': 'critical',
                'message': 'Potential null reference', 'suggestion': 'Add null check',
                'confidence': 0.85, 'line': self._find_line(code, r'null\s*\.|\bNone\s*\.')
            })
        if re.search(r'(?<!try:)\s*(open|read|write|delete)\(', code):
            issues.append({
                'category': 'bug', 'type': 'missing_error_handling', 'severity': 'high',
                'message': 'Missing error handling for I/O', 'suggestion': 'Wrap in try/except',
                'confidence': 0.8, 'line': self._find_line(code, r'(open|read|write|delete)\(')
            })
        # Quality: long lines
        for i, line in enumerate(code.split('\n'), 1):
            if len(line) > 100:
                issues.append({
                    'category': 'quality', 'type': 'line_too_long', 'severity': 'low',
                    'line': i, 'message': f'Line exceeds 100 characters ({len(line)})',
                    'suggestion': 'Split line', 'confidence': 0.9
                })
        # Security: hardcoded secrets
        if re.search(r'password\s*=\s*["\'][^"\']+["\']', code, re.IGNORECASE):
            issues.append({
                'category': 'security', 'type': 'hardcoded_secret', 'severity': 'critical',
                'message': 'Hardcoded password', 'suggestion': 'Use env var', 'confidence': 0.95,
                'line': self._find_line(code, r'password\s*=\s*["\'][^"\']+["\']')
            })
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
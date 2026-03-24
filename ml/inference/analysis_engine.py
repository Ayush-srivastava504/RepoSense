import re
import torch
import numpy as np
from typing import List, Dict, Any, Optional
from transformers import AutoModelForSequenceClassification, AutoTokenizer
from app.utils.logger import setup_logger
from configs.config import settings
from ml.preprocessing.code_preprocessor import CodePreprocessor

logger = setup_logger(__name__)

class CodeAnalysisEngine:
    def __init__(self, model: AutoModelForSequenceClassification, tokenizer: AutoTokenizer, device: torch.device):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.preprocessor = CodePreprocessor()
        self.confidence_threshold = settings.inference.CONFIDENCE_THRESHOLD
    
    def analyze(self, code: str, language: str, focus_areas: Optional[List[str]] = None) -> List[Dict[str, Any]]:
        chunks = self.preprocessor.preprocess(code, language)
        all_issues = []
        
        for chunk in chunks:
            chunk_issues = self._analyze_chunk(chunk, language)
            all_issues.extend(chunk_issues)
        
        if focus_areas:
            all_issues = [i for i in all_issues if i['category'] in focus_areas]
        
        all_issues.sort(key=lambda x: x['confidence'], reverse=True)
        
        return all_issues[:settings.inference.TOP_K_ISSUES]
    
    def _analyze_chunk(self, code: str, language: str) -> List[Dict[str, Any]]:
        issues = []
        
        issues.extend(self._detect_bugs(code, language))
        issues.extend(self._analyze_quality(code, language))
        issues.extend(self._check_readability(code, language))
        
        return issues
    
    def _detect_bugs(self, code: str, language: str) -> List[Dict[str, Any]]:
        issues = []
        
        patterns = {
            'null_reference': {
                'pattern': r'null\s*\.|\bNone\s*\.',
                'severity': 'critical',
                'message': 'Potential null reference detected',
                'suggestion': 'Add null check before accessing property'
            },
            'missing_error_handling': {
                'pattern': r'(?<!try:)\s*(open|read|write|delete)\(',
                'severity': 'high',
                'message': 'Missing error handling for I/O operation',
                'suggestion': 'Wrap operation in try-catch block'
            },
            'resource_leak': {
                'pattern': r'(open|connect)\s*\([^)]*\)(?!\s*\.close)',
                'severity': 'high',
                'message': 'Potential resource leak detected',
                'suggestion': 'Use context manager or ensure resource cleanup'
            }
        }
        
        for pattern_name, pattern_info in patterns.items():
            if re.search(pattern_info['pattern'], code):
                issues.append({
                    'category': 'bug',
                    'type': pattern_name,
                    'severity': pattern_info['severity'],
                    'message': pattern_info['message'],
                    'suggestion': pattern_info['suggestion'],
                    'confidence': 0.85
                })
        
        return issues
    
    def _analyze_quality(self, code: str, language: str) -> List[Dict[str, Any]]:
        issues = []
        lines = code.split('\n')
        
        for i, line in enumerate(lines):
            if len(line) > 100:
                issues.append({
                    'category': 'quality',
                    'type': 'line_too_long',
                    'severity': 'low',
                    'line': i + 1,
                    'message': f'Line exceeds 100 characters ({len(line)})',
                    'suggestion': 'Break line into multiple lines',
                    'confidence': 0.9
                })
            
            complexity = self._calculate_line_complexity(line)
            if complexity > 10:
                issues.append({
                    'category': 'quality',
                    'type': 'high_complexity',
                    'severity': 'medium',
                    'line': i + 1,
                    'message': f'Line has high complexity ({complexity})',
                    'suggestion': 'Simplify complex expression',
                    'confidence': 0.8
                })
        
        return issues
    
    def _check_readability(self, code: str, language: str) -> List[Dict[str, Any]]:
        issues = []
        
        if len(code.split('\n')) > 50:
            issues.append({
                'category': 'readability',
                'type': 'long_function',
                'severity': 'medium',
                'message': 'Function or code block is too long',
                'suggestion': 'Break into smaller functions',
                'confidence': 0.75
            })
        
        hardcoded_patterns = [
            (r'password\s*=\s*["\'][^"\']+["\']', 'Hardcoded password detected'),
            (r'api[_-]?key\s*=\s*["\'][^"\']+["\']', 'Hardcoded API key detected'),
        ]
        
        for pattern, message in hardcoded_patterns:
            if re.search(pattern, code, re.IGNORECASE):
                issues.append({
                    'category': 'security',
                    'type': 'hardcoded_secret',
                    'severity': 'critical',
                    'message': message,
                    'suggestion': 'Use environment variables or secure vault',
                    'confidence': 0.95
                })
        
        return issues
    
    def _calculate_line_complexity(self, line: str) -> int:
        complexity = 0
        complexity += line.count('if') * 2
        complexity += line.count('else') * 2
        complexity += line.count('for') * 3
        complexity += line.count('while') * 3
        complexity += line.count('and') * 1
        complexity += line.count('or') * 1
        complexity += line.count('lambda') * 2
        return complexity
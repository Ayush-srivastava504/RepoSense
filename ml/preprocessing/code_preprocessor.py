import re
from typing import List, Tuple
from configs.config import settings

class CodePreprocessor:
    def __init__(self):
        self.max_length = settings.preprocessing.MAX_CODE_LENGTH
        self.chunk_size = settings.preprocessing.CHUNK_SIZE
    
    def preprocess(self, code: str, language: str) -> List[str]:
        code = self._normalize_code(code, language)
        
        if len(code) <= self.max_length:
            return [code]
        
        return self._chunk_code(code)
    
    def _normalize_code(self, code: str, language: str) -> str:
        if settings.preprocessing.REMOVE_COMMENTS:
            code = self._remove_comments(code, language)
        
        if settings.preprocessing.NORMALIZE_WHITESPACE:
            code = self._normalize_whitespace(code)
        
        return code
    
    def _remove_comments(self, code: str, language: str) -> str:
        if language == "python":
            code = re.sub(r'#.*$', '', code, flags=re.MULTILINE)
            code = re.sub(r'""".*?"""', '', code, flags=re.DOTALL)
        elif language in ["javascript", "typescript", "java"]:
            code = re.sub(r'//.*$', '', code, flags=re.MULTILINE)
            code = re.sub(r'/\*.*?\*/', '', code, flags=re.DOTALL)
        
        return code
    
    def _normalize_whitespace(self, code: str) -> str:
        code = re.sub(r'[ \t]+', ' ', code)
        code = re.sub(r'\n\s*\n', '\n', code)
        return code.strip()
    
    def _chunk_code(self, code: str) -> List[str]:
        lines = code.split('\n')
        chunks = []
        
        for i in range(0, len(lines), self.chunk_size):
            chunk = '\n'.join(lines[i:i + self.chunk_size])
            chunks.append(chunk)
        
        return chunks
    
    def extract_features(self, code: str) -> dict:
        lines = code.split('\n')
        return {
            'line_count': len(lines),
            'char_count': len(code),
            'blank_lines': sum(1 for line in lines if not line.strip()),
            'avg_line_length': sum(len(line) for line in lines) / max(len(lines), 1)
        }
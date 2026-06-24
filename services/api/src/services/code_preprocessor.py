# ml/preprocessing/code_preprocessor.py

class CodePreprocessor:
    """
    Normalises raw code before it reaches the analyser.
    Extend this with language-specific cleaning as needed.
    """

    def preprocess(self, code: str, language: str = "python") -> str:
        code = self._normalize_line_endings(code)
        code = self._strip_bom(code)
        code = self._expand_tabs(code)
        return code

    @staticmethod
    def _normalize_line_endings(code: str) -> str:
        return code.replace("\r\n", "\n").replace("\r", "\n")

    @staticmethod
    def _strip_bom(code: str) -> str:
        return code.lstrip("\ufeff")

    @staticmethod
    def _expand_tabs(code: str, tab_size: int = 4) -> str:
        return code.expandtabs(tab_size)

    @staticmethod
    def line_count(code: str) -> int:
        return len(code.splitlines())
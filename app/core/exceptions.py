from fastapi import HTTPException, status

class CodeReviewerException(HTTPException):
    def __init__(self, status_code: int, detail: str):
        super().__init__(status_code=status_code, detail=detail)

class ModelLoadError(CodeReviewerException):
    def __init__(self, detail: str = "Failed to load model"):
        super().__init__(status.HTTP_503_SERVICE_UNAVAILABLE, detail)

class ValidationError(CodeReviewerException):
    def __init__(self, detail: str = "Invalid input"):
        super().__init__(status.HTTP_400_BAD_REQUEST, detail)

class RateLimitExceeded(CodeReviewerException):
    def __init__(self, detail: str = "Rate limit exceeded"):
        super().__init__(status.HTTP_429_TOO_MANY_REQUESTS, detail)

class ProcessingTimeout(CodeReviewerException):
    def __init__(self, detail: str = "Request processing timeout"):
        super().__init__(status.HTTP_408_REQUEST_TIMEOUT, detail)
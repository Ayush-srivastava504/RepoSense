import os
from typing import Optional, List
from pydantic_settings import BaseSettings
from pydantic import Field

class ModelConfig(BaseSettings):
    MODEL_NAME: str = Field(default="microsoft/codebert-base", env="MODEL_NAME")
    DEVICE: str = Field(default="cpu", env="DEVICE")
    MAX_TOKENS: int = Field(default=512, env="MAX_TOKENS")
    QUANTIZATION_ENABLED: bool = Field(default=False, env="QUANTIZATION_ENABLED")
    MODEL_CACHE_DIR: str = Field(default="./.model_cache", env="MODEL_CACHE_DIR")
    
    class Config:
        env_prefix = "MODEL_"

class PreprocessingConfig(BaseSettings):
    MAX_CODE_LENGTH: int = Field(default=10000, env="PREPROCESS_MAX_CODE_LENGTH")
    CHUNK_SIZE: int = Field(default=500, env="PREPROCESS_CHUNK_SIZE")
    REMOVE_COMMENTS: bool = Field(default=True, env="PREPROCESS_REMOVE_COMMENTS")
    NORMALIZE_WHITESPACE: bool = Field(default=True, env="PREPROCESS_NORMALIZE_WHITESPACE")
    
    class Config:
        env_prefix = "PREPROCESS_"

class InferenceConfig(BaseSettings):
    CONFIDENCE_THRESHOLD: float = Field(default=0.7, env="INFERENCE_CONFIDENCE_THRESHOLD")
    TOP_K_ISSUES: int = Field(default=20, env="INFERENCE_TOP_K_ISSUES")
    BATCH_SIZE: int = Field(default=4, env="INFERENCE_BATCH_SIZE")
    
    class Config:
        env_prefix = "INFERENCE_"

class APIConfig(BaseSettings):
    HOST: str = Field(default="0.0.0.0", env="API_HOST")
    PORT: int = Field(default=8000, env="API_PORT")
    ENVIRONMENT: str = Field(default="development", env="ENVIRONMENT")
    REQUEST_TIMEOUT: int = Field(default=60, env="API_REQUEST_TIMEOUT")
    CORS_ORIGINS: List[str] = Field(default=["*"], env="API_CORS_ORIGINS")
    
    class Config:
        env_prefix = "API_"

class LoggingConfig(BaseSettings):
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FILE: Optional[str] = Field(default=None, env="LOG_FILE")
    LOG_FORMAT: str = Field(default="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
    
    class Config:
        env_prefix = "LOG_"

class SecurityConfig(BaseSettings):
    API_KEY_ENABLED: bool = Field(default=False, env="SECURITY_API_KEY_ENABLED")
    API_KEY: Optional[str] = Field(default=None, env="SECURITY_API_KEY")
    MAX_REQUEST_SIZE: int = Field(default=10 * 1024 * 1024, env="SECURITY_MAX_REQUEST_SIZE")
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="SECURITY_RATE_LIMIT_REQUESTS")
    RATE_LIMIT_PERIOD: int = Field(default=60, env="SECURITY_RATE_LIMIT_PERIOD")
    
    class Config:
        env_prefix = "SECURITY_"

class Settings:
    def __init__(self):
        self.model = ModelConfig()
        self.preprocessing = PreprocessingConfig()
        self.inference = InferenceConfig()
        self.api = APIConfig()
        self.logging = LoggingConfig()
        self.security = SecurityConfig()
        # Additional flat settings that were previously in settings.py
        import os
        self.DATABASE_URL = os.getenv(
            "DATABASE_URL",
            "postgresql://postgres:postgres@localhost:5432/postgres",
        )
        # Optional fields – default to empty strings to avoid validation errors
        self.REDIS_URL = os.getenv("REDIS_URL", "")
        self.GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "")
        self.GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "")
        self.STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
        self.STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
        self.JWT_SECRET = os.getenv("JWT_SECRET", "")
        self.GITHUB_TOKEN_ENCRYPTION_KEY = os.getenv("GITHUB_TOKEN_ENCRYPTION_KEY", "")
        self.AWS_ACCESS_KEY = os.getenv("AWS_ACCESS_KEY", "")
        self.AWS_SECRET_KEY = os.getenv("AWS_SECRET_KEY", "")
        self.GITHUB_REDIRECT_URI = os.getenv("GITHUB_REDIRECT_URI", "")
        self.FRONTEND_URL = os.getenv("FRONTEND_URL", "")
    
    @property
    def is_production(self) -> bool:
        return self.api.ENVIRONMENT == "production"
    
    @property
    def is_development(self) -> bool:
        return self.api.ENVIRONMENT == "development"

settings = Settings()
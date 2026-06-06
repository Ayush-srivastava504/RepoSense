from pydantic_settings import BaseSettings
from typing import List
import json

class Settings(BaseSettings):
    # Default to a local PostgreSQL instance. Users can override via .env.
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/postgres"
    REDIS_URL: str = ""
    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    JWT_SECRET: str = ""
    GITHUB_TOKEN_ENCRYPTION_KEY: str = ""
    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""
    S3_BUCKET: str = "resume-storage"
    # Allowed origins for CORS. Include both API and frontend URLs.
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    # Default redirect URI for GitHub OAuth flow. Adjust if your frontend runs on a different host/port.
    GITHUB_REDIRECT_URI: str = "http://localhost:3000/api/github/callback"
    # Base URL of the frontend application used for redirects after login failures.
    FRONTEND_URL: str = "http://localhost:3000"

    RAG_SERVICE_URL: str = "http://rag:8001"

    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = json.loads(self.CORS_ORIGINS)

settings = Settings()
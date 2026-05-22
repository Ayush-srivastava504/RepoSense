from typing import List
import json

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"

    PORT: int = 8000

    ENVIRONMENT: str = "development"

    DATABASE_URL: str = (
        "postgresql://postgres:postgres@localhost:5432/postgres"
    )

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

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    GITHUB_REDIRECT_URI: str = ""

    FRONTEND_URL: str = ""

    RAG_SERVICE_URL: str = "http://rag:8001"

    class Config:
        env_file = ".env"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        if isinstance(
            self.CORS_ORIGINS,
            str,
        ):
            self.CORS_ORIGINS = json.loads(
                self.CORS_ORIGINS
            )


settings = Settings()
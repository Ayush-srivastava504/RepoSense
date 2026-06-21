from typing import List
import json

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"

    PORT: int = 8000

    ENVIRONMENT: str = "development"

    DATABASE_URL: str = (
        "postgresql://postgres:password@postgres:5432/internship_db"
    )

    REDIS_URL: str = (
        "redis://redis:6379"
    )

    GITHUB_CLIENT_ID: str = ""
    GITHUB_CLIENT_SECRET: str = ""

    RAZORPAY_KEY_ID: str = ""
    RAZORPAY_KEY_SECRET: str = ""

    JWT_SECRET: str = ""

    GITHUB_TOKEN_ENCRYPTION_KEY: str = ""

    # Renamed from AWS_ACCESS_KEY / AWS_SECRET_KEY to match .env and boto3 defaults
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "us-east-1"

    S3_BUCKET: str = "resume-storage"

    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8000",
    ]

    GITHUB_REDIRECT_URI: str = ""

    FRONTEND_URL: str = ""

    RAG_SERVICE_URL: str = (
        "http://localhost:8001"
    )

    NEURAL_GENERATOR_URL: str = (
        "http://localhost:8002"
    )

    class Config:
        env_file = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "../../../../.env")
        )
        extra = "ignore"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)

        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = json.loads(self.CORS_ORIGINS)


settings = Settings()
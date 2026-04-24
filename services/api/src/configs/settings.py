from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str
    REDIS_URL: str
    GITHUB_CLIENT_ID: str
    GITHUB_CLIENT_SECRET: str
    STRIPE_SECRET_KEY: str
    STRIPE_WEBHOOK_SECRET: str
    JWT_SECRET: str
    GITHUB_TOKEN_ENCRYPTION_KEY: str
    AWS_ACCESS_KEY: str
    AWS_SECRET_KEY: str
    S3_BUCKET: str = "resume-storage"
    CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:8000"]

    class Config:
        env_file = ".env"

settings = Settings()
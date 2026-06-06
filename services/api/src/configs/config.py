from typing import List
import json

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    HOST: str = "0.0.0.0"

    PORT: int = 8000

    ENVIRONMENT: str = "development"

    # Default connection strings point to Docker service names. These can be
    # overridden by environment variables (via .env) when running locally.
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

    AWS_ACCESS_KEY: str = ""
    AWS_SECRET_KEY: str = ""

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
        # Load environment variables from the repository root .env file.
        # The default relative path resolves against the current working
        # directory, which may be ``services`` when the app is started.
        # Using an absolute path ensures the file is found regardless of cwd.
        # The repository root .env is four levels up from this file:
        # configs -> src -> api -> services -> <repo root>
        env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../../.env"))
        extra = "ignore"

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
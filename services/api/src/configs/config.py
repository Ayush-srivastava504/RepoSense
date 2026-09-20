# Module: src/configs/config.py
# Defines class(es): Settings
#
#

from typing import List
import json
from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    HOST: str = '0.0.0.0'
    PORT: int = 8000
    ENVIRONMENT: str = 'development'
    DATABASE_URL: str = ''
    REDIS_URL: str = 'redis://redis:6379'
    GITHUB_CLIENT_ID: str = ''
    GITHUB_CLIENT_SECRET: str = ''
    RAZORPAY_KEY_ID: str = ''
    RAZORPAY_KEY_SECRET: str = ''
    JWT_SECRET: str = ''
    GITHUB_TOKEN_ENCRYPTION_KEY: str = ''
    AWS_ACCESS_KEY_ID: str = ''
    AWS_SECRET_ACCESS_KEY: str = ''
    AWS_REGION: str = 'us-east-1'
    S3_BUCKET: str = 'resume-storage'
    CORS_ORIGINS: List[str] = ['http://localhost:3000', 'http://localhost:8000']
    CORS_ORIGIN_REGEX: str = '^https://([a-zA-Z0-9\\-]+\\.)*vercel\\.app$|^https://(www\\.)?intern-flow\\.in$'
    GITHUB_REDIRECT_URI: str = ''
    FRONTEND_URL: str = ''
    RAG_SERVICE_URL: str = 'http://localhost:8001'
    NEURAL_GENERATOR_URL: str = 'http://localhost:8002'
    EMAIL_PROVIDER: str = 'resend'
    RESEND_API_KEY: str = ''
    REQUIRE_AUTH: bool = False
    LOAD_TEST_BYPASS_KEY: str = ''
    # Shared secret the Next.js tier sends as X-Internal-Key on server-to-server calls so
    # SSR/ISR/sitemap traffic (shared Vercel egress IPs) is not throttled by the per-IP limit.
    INTERNAL_API_KEY: str = ''
    GROQ_API_KEY: str = ''

    # Phase F — same-day priority indexing push (see
    # INDEXING_RECOVERY_PLAN.md and scripts/phase_f_priority_index_push.py).
    # INDEXNOW_KEY must match the deployed key file at
    # https://<host>/<key>.txt (apps/web/public/<key>.txt) — same key
    # scripts/indexnow-submit.mjs already uses, kept as the same default
    # here so the two don't silently drift apart if neither env var is set.
    INDEXNOW_KEY: str = '97f076150822494092783dfc5c2c8a09'
    INDEXNOW_HOST: str = 'intern-flow.in'
    # Raw service-account JSON (the whole key file's contents, as one
    # env var) for Google's Indexing API. Only ever used to push URLs for
    # pages that carry JobPosting structured data — see the script header
    # for why that scoping isn't optional. Leave empty to skip the Google
    # leg and push to IndexNow only.
    GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON: str = ''
    # Default Indexing API quota is 200 requests/day per GCP project;
    # leave headroom below that rather than assuming a quota increase.
    GOOGLE_INDEXING_DAILY_QUOTA: int = 180

    class Config:
        env_file = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../.env'))
        extra = 'ignore'

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if isinstance(self.CORS_ORIGINS, str):
            self.CORS_ORIGINS = json.loads(self.CORS_ORIGINS)
settings = Settings()

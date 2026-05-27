#  RepoSense Main API Service

> FastAPI-based REST API serving as the central gateway for the RepoSense platform. Handles authentication, code review orchestration, job searching, resume processing, GitHub integration, and Razorpay subscription management.

## Overview

The Main API (`services/api/`) is the heart of RepoSense. It:
- **Routes requests** to microservices (Crawler, RAG, Neural Generator)
- **Manages authentication** with JWT tokens and GitHub OAuth 2.0
- **Implements rate limiting** (100 req/min free, 500+ req/min paid)
- **Caches responses** using Redis (optional)
- **Handles payments** via Razorpay webhooks
- **Provides OpenAPI documentation** via Swagger UI

## Tech Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| **Framework** | FastAPI 0.100+ | Async Python web framework |
| **Validation** | Pydantic v2 | Data validation & serialization |
| **Database** | PostgreSQL 12+ (asyncpg) | Async database driver |
| **Cache** | Redis (optional) | In-memory caching |
| **Auth** | JWT + OAuth 2.0 | Token-based auth |
| **Encryption** | Fernet (cryptography) | Secure GitHub token storage |
| **HTTP** | httpx | Async HTTP client |
| **Async** | asyncio | Concurrent request handling |
| **Monitoring** | structlog | Structured logging |

## Quick Start

### Prerequisites

- **Python** 3.11+
- **PostgreSQL** 12+
- **pip & virtualenv**
- **Optional:** Redis, Docker

### Installation (3 minutes)

```bash
# 1. Navigate to backend
cd services

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate              # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env file (see Configuration section below)
cp .env.example .env
# Edit .env with your settings

# 5. Initialize database
python run_migrations.py

# 6. Start the API
python app.py
```

**API Running at:**
- **HTTP API:** http://localhost:8000
- **Swagger Docs:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

## Configuration

### Environment Variables

Create a `.env` file in the `services/` directory:

```bash
# ================= DATABASE =================
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db
DATABASE_POOL_SIZE=20                    # Connection pool size
DATABASE_MAX_OVERFLOW=10                 # Max overflow connections

# ================= CACHE (Optional) =================
REDIS_URL=redis://localhost:6379/0
CACHE_TTL=300                            # 5 minutes

# ================= AUTHENTICATION =================
JWT_SECRET=your_secret_key_minimum_32_characters_long_here
JWT_ALGORITHM=HS256
JWT_EXPIRY_HOURS=24

# ================= GITHUB OAUTH =================
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=Fernet_key_from_cryptography

# Generate encryption key:
# python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# ================= FRONTEND =================
FRONTEND_URL=http://localhost:3000

# ================= RAZORPAY (Optional) =================
RAZORPAY_KEY_ID=rzp_test_your_key
RAZORPAY_KEY_SECRET=your_razorpay_key_secret

# ================= MODELS =================
MODEL_PATH=/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx
MODEL_CACHE_DIR=.model_cache

# ================= CRAWLER =================
SCRAPER_DEBUG=false
MAX_WORKERS=4                            # Parallel scrapers
REQUEST_TIMEOUT=30                       # Seconds

# ================= LOGGING =================
LOG_LEVEL=INFO
SENTRY_DSN=https://your-sentry-key@sentry.io/project  # Optional
```

### Database Schema

The API creates these tables automatically via migrations:

```sql
-- Users: GitHub OAuth + subscription info
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    github_id INTEGER UNIQUE,
    github_token TEXT ENCRYPTED,          -- Fernet encrypted
    subscription_tier TEXT DEFAULT 'free', -- free | pro | enterprise
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Reviews: Code analysis history
CREATE TABLE reviews (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    code TEXT NOT NULL,
    language TEXT,
    issues JSONB,                         -- Analysis results
    score INTEGER,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Resumes: User-uploaded resumes
CREATE TABLE resumes (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    filename TEXT,
    content JSONB,                        -- Parsed resume
    embeddings FLOAT8[],                  -- For RAG
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs: Scraped from 9+ sites
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT,
    description TEXT,
    source TEXT,                          -- indeed, linkedin, etc
    url TEXT UNIQUE,
    location TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    posted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Subscriptions: Stripe payment records
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    tier TEXT,
    status TEXT,                          -- active | canceled | past_due
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Repo Docs: GitHub repository documentation
CREATE TABLE repo_docs (
    id UUID PRIMARY KEY,
    user_id UUID REFERENCES users(id),
    repo_name TEXT,
    repo_url TEXT,
    readme_content TEXT,                  -- Generated README
    embeddings FLOAT8[],                  -- For RAG search
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Environment Setup

## Complete API Endpoint Reference

### Authentication Endpoints

#### `POST /api/auth/github/login`
Initiate GitHub OAuth flow.

**Response:**
```json
{
  "login_url": "https://github.com/login/oauth/authorize?client_id=..."
}
```

#### `GET /api/auth/github/callback?code={code}&state={state}`
GitHub OAuth callback (handled by backend, redirects to frontend with JWT).

**Redirect URL:**
```
http://localhost:3000/github?token=eyJhbGc...
```

#### `POST /api/auth/logout`
Invalidate JWT token.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "message": "Successfully logged out"
}
```

#### `GET /api/auth/me`
Get current authenticated user.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "github_username": "johndoe",
  "subscription_tier": "free",
  "created_at": "2024-01-15T10:30:00Z"
}
```

### Code Review Endpoints

#### `POST /api/review/submit`
Submit code for AI analysis.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "code": "def calculate_sum(a, b):\n    return a+b",
  "language": "python",
  "focus_areas": ["security", "performance", "style"],
  "context": "Utility function for calculations"
}
```

**Response:**
```json
{
  "review_id": "rev_550e8400e29b41d4",
  "status": "completed",
  "issues": [
    {
      "line": 1,
      "column": 28,
      "severity": "info",
      "type": "style",
      "message": "Add docstring to function",
      "suggestion": "def calculate_sum(a, b):\n    \"\"\"Return sum of a and b.\"\"\"\n    return a+b",
      "confidence": 0.95
    },
    {
      "line": 2,
      "column": 11,
      "severity": "warning",
      "type": "performance",
      "message": "Consider type hints",
      "suggestion": "def calculate_sum(a: int, b: int) -> int:",
      "confidence": 0.87
    }
  ],
  "quality_score": 72,
  "analysis_time_ms": 245,
  "analyzed_at": "2024-01-15T10:35:22Z"
}
```

#### `GET /api/review/{review_id}`
Retrieve a previous review.

**Headers:** `Authorization: Bearer {token}`

**Response:** Same as above

#### `GET /api/review/history?page=1&limit=20`
Get user's review history.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "total": 42,
  "page": 1,
  "limit": 20,
  "reviews": [
    {
      "review_id": "rev_550e8400e29b41d4",
      "language": "python",
      "quality_score": 72,
      "analyzed_at": "2024-01-15T10:35:22Z"
    }
  ]
}
```

### Job Listing Endpoints

#### `GET /api/jobs/search?query=python&location=Bangalore&page=1&limit=20`
Search jobs with filters.

**Query Parameters:**
- `query`: Job title or keywords (required)
- `location`: Job location
- `source`: Filter by platform (linkedin, indeed, naukri, etc.)
- `salary_min`: Minimum salary
- `salary_max`: Maximum salary
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20)

**Response:**
```json
{
  "total": 567,
  "page": 1,
  "limit": 20,
  "jobs": [
    {
      "id": "indeed_12345",
      "title": "Senior Python Developer",
      "company": "TechCorp",
      "location": "Bangalore, India",
      "description": "Looking for experienced Python developer...",
      "salary_min": 50000,
      "salary_max": 120000,
      "source": "indeed",
      "url": "https://...",
      "posted_at": "2024-01-14T00:00:00Z",
      "skills": ["Python", "FastAPI", "PostgreSQL"]
    }
  ]
}
```

#### `GET /api/jobs/{job_id}`
Get detailed job information.

**Response:** Single job object (from search results)

#### `POST /api/jobs/{job_id}/match`
Match current user's resume to job.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "resume_id": "res_550e8400e29b41d4"
}
```

**Response:**
```json
{
  "match_score": 0.87,
  "missing_skills": ["Kubernetes", "Docker"],
  "matching_skills": ["Python", "PostgreSQL", "API Design"],
  "recommendation": "Your Python and database skills are strong. Consider learning Kubernetes for better prospects."
}
```

### Resume Endpoints

#### `POST /api/resume/upload`
Upload and parse a resume.

**Headers:** `Authorization: Bearer {token}`, `Content-Type: multipart/form-data`

**Form Data:**
- `file`: Resume file (PDF, DOCX, TXT)
- `filename`: Original filename (optional)

**Response:**
```json
{
  "resume_id": "res_550e8400e29b41d4",
  "filename": "john_doe_resume.pdf",
  "parsed": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+91-9999-999999",
    "skills": ["Python", "FastAPI", "PostgreSQL", "React"],
    "experience": [
      {
        "title": "Senior Developer",
        "company": "TechCorp",
        "duration": "2 years",
        "description": "..."
      }
    ],
    "education": [
      {
        "degree": "B.Tech",
        "field": "Computer Science",
        "institution": "IIT Bombay",
        "year": "2018"
      }
    ]
  },
  "uploaded_at": "2024-01-15T11:00:00Z"
}
```

#### `GET /api/resume/{resume_id}`
Get parsed resume details.

**Headers:** `Authorization: Bearer {token}`

**Response:** Same as upload response (parsed section)

#### `POST /api/resume/{resume_id}/analyze`
Get AI analysis and recommendations.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "analysis": {
    "strengths": [
      "Strong backend development experience",
      "Good database design knowledge"
    ],
    "gaps": [
      "Limited frontend experience",
      "No cloud deployment experience"
    ],
    "recommendations": [
      "Add React/Vue.js projects to portfolio",
      "Learn AWS/GCP for cloud deployment"
    ]
  }
}
```

### GitHub Integration Endpoints

#### `GET /api/github/repos`
List authenticated user's GitHub repositories.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "repos": [
    {
      "name": "my-awesome-project",
      "url": "https://github.com/johndoe/my-awesome-project",
      "description": "An awesome project",
      "stars": 42,
      "language": "Python",
      "updated_at": "2024-01-10T00:00:00Z"
    }
  ]
}
```

#### `GET /api/github/{owner}/{repo}/files?path=src/`
Browse repository files.

**Headers:** `Authorization: Bearer {token}`

**Query Parameters:**
- `path`: Directory path (default: root)

**Response:**
```json
{
  "files": [
    {
      "name": "app.py",
      "type": "file",
      "size": 2048,
      "url": "https://raw.githubusercontent.com/.../app.py"
    },
    {
      "name": "models",
      "type": "directory",
      "url": "https://github.com/.../tree/main/models"
    }
  ]
}
```

#### `GET /api/github/{owner}/{repo}/file?path=README.md`
Get file content (raw).

**Response:**
```
# My Awesome Project

This is my awesome project...
```

#### `POST /api/github/{owner}/{repo}/auto-setup`
Generate README using RAG.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "status": "readme_generated",
  "readme": "# My Awesome Project\n\n## Overview\n...",
  "generated_at": "2024-01-15T11:30:00Z"
}
```

### Subscription Endpoints

#### `GET /api/subscription/status`
Get current subscription status.

**Headers:** `Authorization: Bearer {token}`

**Response:**
```json
{
  "tier": "free",
  "limits": {
    "reviews_per_month": 10,
    "jobs_searches": 50,
    "storage_mb": 100
  },
  "usage": {
    "reviews_used": 7,
    "jobs_searches_used": 32,
    "storage_used": 45
  },
  "renewal_date": null
}
```

#### `POST /api/subscription/upgrade`
Upgrade to premium tier.

**Headers:** `Authorization: Bearer {token}`

**Request Body:**
```json
{
  "plan": "pro"
}
```

**Response:**
```json
{
  "checkout_url": "https://checkout.stripe.com/...",
  "session_id": "cs_live_..."
}
```

#### `POST /api/webhook/stripe`
Stripe webhook for payment events (automatic).

**Headers:** `X-Stripe-Signature: {signature}`

Auto-updates subscription status when payments succeed/fail.

## Authentication & Security

### JWT Token Structure

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyX2lkIiwiaWF0IjoxNjMxNTk5ODAwLCJleHAiOjE2MzE2ODYyMDB9.signature
```

### Adding JWT to Requests

```bash
# Bash/curl
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:8000/api/auth/me

# JavaScript/Fetch
fetch('http://localhost:8000/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

# Python/Requests
import requests
headers = {'Authorization': f'Bearer {token}'}
requests.get('http://localhost:8000/api/auth/me', headers=headers)
```

## Docker & Deployment

### Build Docker Image

```bash
cd services
docker build -t repo-sense-api:latest .
```

### Run with Docker Compose

```bash
docker-compose -f ../infrastructure/docker/docker-compose.yml up -d
```

### Environment Variables for Docker

```bash
docker run -d \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://db:5432/internship_db \
  -e JWT_SECRET=your_secret \
  -e GITHUB_CLIENT_ID=your_id \
  -e GITHUB_CLIENT_SECRET=your_secret \
  repo-sense-api:latest
```

## Testing

```bash
# Run all tests
pytest -v

# Test specific endpoint
pytest tests/test_api.py::test_review_submit -v

# With coverage
pytest --cov=src tests/

# Integration tests
pytest tests/test_api.py -m integration
```

## Monitoring & Logs

```bash
# View logs
docker-compose logs -f api

# Structured logs in file
tail -f logs/app.log

# Monitor with Sentry (if configured)
# Check https://sentry.io for error tracking
```

## Related Services

- **Frontend:** [apps/web/README.md](../../apps/web/README.md)
- **Crawler:** [services/api/crawler/README.md](./crawler/README.md)
- **RAG Service:** [services/api/rag/README.md](./rag/README.md)
- **Neural Generator:** [services/api/neural_generator/README.md](./neural_generator/README.md)
- **Deployment:** [docs/DEPLOYMENT_GUIDE.md](../../docs/DEPLOYMENT_GUIDE.md)

---

**For more help:** See the [main README.md](../../README.md) or [SETUP_GUIDE.md](../../docs/SETUP_GUIDE.md)
```

##  Performance & Rate Limiting

### Rate Limits (per IP/User)

| Tier | Requests/min | Burst | Cache |
|------|-------------|-------|-------|
| **Free** | 100 | 10 | 5min |
| **Pro** | 500 | 50 | 60min |
| **Enterprise** | Unlimited | Unlimited | Custom |

### Caching

```python
# Reviews cached for 5 minutes in Redis
# Key: review:{user_id}:{code_hash}
# Hit rate: ~60% for power users
```

### Concurrency

```
Max concurrent: 100+ (FastAPI async)
DB connections: 5 (pool)
Memory per req: ~10-50MB
Total RAM needed: 512MB (container), 2GB (VM)
```

##  Troubleshooting

### API won't start

```bash
# Check imports
python api/test_imports.py

# Check settings
python -c "from api.src.configs.config import settings; print(settings)"

# Check database connection
python -c "import asyncio; from api.src.configs.db import create_pool; asyncio.run(create_pool())"
```

### Database connection fails

```bash
# Verify PostgreSQL running
psql -U postgres -d internship_db -c "SELECT 1"

# Check DATABASE_URL format
# postgresql://user:pass@host:port/database
```

### JWT errors

```bash
# Regenerate JWT_SECRET (32+ chars)
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Set new secret in .env
JWT_SECRET=<new_secret>
```

### GitHub OAuth fails

```bash
# Verify GitHub App credentials
# Settings → Developer settings → OAuth Apps → Repo Sense

# Check redirect URI matches
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
```

### Rate limit issues

```bash
# Increase limits for development
RATE_LIMIT_REQUESTS=10000
RATE_LIMIT_PERIOD=60

# Or use Pro subscription tier
```

##  Monitoring

### Health Check

```bash
curl http://localhost:8000/health
# {"status": "ok", "db": "connected", "redis": "connected"}
```

### Request Logs

```
[2024-01-15 10:30:00] POST /api/review 200 45ms
[2024-01-15 10:30:01] GET /api/jobs 200 120ms
```

### Database Queries

```python
# Enable query logging
export LOG_LEVEL=DEBUG

# View slow queries
SELECT query, calls, mean_time FROM pg_stat_statements
WHERE mean_time > 100
ORDER BY mean_time DESC;
```

##  Testing

```bash
# Run all tests
pytest tests/

# Run specific test
pytest tests/test_api.py::test_login

# With coverage
pytest tests/ --cov=api/src

# Test imports
python api/test_imports.py
```

## Deployment

### Railway.app (Recommended)

```bash
# Link project
railway link

# Deploy
railway up

# View logs
railway logs -f

# Set environment variables
railway variables add DATABASE_URL=postgresql://...
```

### Traditional VPS (systemd)

```bash
sudo tee /etc/systemd/system/repo-sense-api.service << EOF
[Unit]
Description=Repo Sense API
After=network.target postgresql.service

[Service]
Type=simple
User=repo-sense
WorkingDirectory=/opt/repo-sense/services
Environment="DATABASE_URL=postgresql://..."
Environment="JWT_SECRET=..."
ExecStart=/usr/bin/python3 app.py
Restart=on-failure
RestartSec=10s

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl enable repo-sense-api
sudo systemctl start repo-sense-api
sudo journalctl -u repo-sense-api -f
```

### AWS EC2 (Docker)

```bash
# Push to ECR
aws ecr get-login-password --region us-east-1 | docker login ...
docker tag repo-sense-api:latest 123456.dkr.ecr.us-east-1.amazonaws.com/repo-sense-api:latest
docker push 123456.dkr.ecr.us-east-1.amazonaws.com/repo-sense-api:latest

# Deploy with ECS/Fargate
```

##  Related Services

- **Frontend**: [apps/web/README.md](../../apps/web/README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](../neural-generator/README.md)
- **RAG Service**: [services/api/rag/README.md](../rag/README.md)
- **Crawler**: [services/api/crawler/README.md](../crawler/README.md)



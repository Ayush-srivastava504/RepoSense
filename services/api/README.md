# 🚀 Repo Sense API Service

FastAPI-based REST API for the AI Code Review Platform. Handles authentication, code analysis, resume processing, job listings, and payment subscriptions. Features OAuth 2.0 GitHub integration, JWT stateless auth, AI-powered code reviews, and seamless integration with Neural Generator and RAG services.

## 🎯 Key Features

- **GitHub OAuth 2.0**: Login via GitHub, encrypted token storage
- **JWT Authentication**: Stateless, token-based access control
- **Code Review API**: Submit code for AI analysis with auto-fix suggestions
- **Resume Processing**: Upload, parse, and analyze resumes with embeddings
- **Job Listings**: Browse 9+ job site aggregations
- **Payments**: Stripe webhook integration for subscriptions
- **Rate Limiting**: 100 req/min (free), 500+ req/min (paid)
- **Caching**: Redis (optional) for 5min review cache
- **Async/Fast**: 100+ concurrent requests on t2.micro
- **Monitoring**: Swagger UI, structured logging, health checks

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **API Framework** | FastAPI + Pydantic |
| **Auth** | JWT + OAuth2 + Fernet encryption |
| **Database** | PostgreSQL (asyncpg) |
| **Cache** | Redis (optional) |
| **Analysis** | Regex patterns + CodeBERT ONNX |
| **Async** | asyncio, httpx |
| **Documentation** | Swagger/OpenAPI |

## 📂 Project Structure

```
services/api/src/
├── core/
│   ├── app.py                      # FastAPI app factory
│   └── dependencies.py             # Rate limiting, API keys
├── routes/
│   ├── auth.py                     # Login, register, OAuth
│   ├── github.py                   # Repo browser, file viewer
│   ├── review.py                   # Code review submissions
│   ├── jobs.py                     # Job listings
│   ├── resume.py                   # Resume upload & analysis
│   └── subscription.py             # Payment & webhooks
├── services/
│   ├── ai_service.py               # Review orchestration
│   ├── analysis_engine.py          # CodeBERT, regex patterns
│   ├── resume_service.py           # Resume parsing
│   ├── github_service.py           # GitHub API client
│   └── stripe_service.py           # Payment handling
├── middleware/
│   └── auth.py                     # JWT verification
├── configs/
│   ├── config.py                   # Unified settings (SINGLE SOURCE!)
│   ├── db.py                       # PostgreSQL pool
│   └── redis.py                    # Redis client
├── schemas/
│   ├── auth.py                     # Auth DTOs
│   ├── code_review.py              # Review request/response
│   └── jobs.py                     # Job listing schema
├── utils/
│   ├── crypto.py                   # Fernet token encryption
│   └── logger.py                   # Structured logging
└── models/
    ├── codebert_tokenizer/         # Tokenizer config
    └── ...

tests/
├── test_imports.py                 # Import validation
├── test_api.py                     # API endpoint tests
├── test_analysis.py                # Code analysis tests
└── ...
```

## 🚀 Quick Start

### Prerequisites

```bash
- Python 3.11+
- PostgreSQL 12+ (running)
- Redis (optional, for caching)
- GitHub OAuth App credentials
```

### Installation

```bash
# Navigate to backend
cd services

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Verify imports
python api/test_imports.py
```

### Environment Setup

```bash
# Create .env file in services/ directory
cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db

# Redis (optional)
REDIS_URL=redis://localhost:6379/0

# GitHub OAuth
GITHUB_CLIENT_ID=your_github_app_id
GITHUB_CLIENT_SECRET=your_github_app_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback
GITHUB_TOKEN=github_personal_token_for_api

# JWT & Security
JWT_SECRET=your_secret_min_32_chars_long_here
GITHUB_TOKEN_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Frontend
FRONTEND_URL=http://localhost:3000

# Stripe (optional)
STRIPE_SECRET_KEY=sk_test_your_key

# Models
MODEL_PATH=/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx

# Optional debugging
SCRAPER_DEBUG=false
EOF
```

### Database Migrations

```bash
# Apply migrations (creates tables)
python run_migrations.py

# Verify tables created
psql -U postgres -d internship_db -c "\dt"
```

### Start API

```bash
# Development
python app.py

# Or with uvicorn
python -m uvicorn api.src.core.app:app --host 0.0.0.0 --port 8000 --reload
```

**API available at:** http://localhost:8000  
**Swagger Docs:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc

## 📚 API Endpoints

### Authentication

```http
POST   /api/auth/register              # Register with email
POST   /api/auth/login                 # Email login
POST   /api/auth/refresh               # Refresh JWT token
GET    /api/auth/me                    # Current user profile
GET    /api/auth/logout                # Logout
```

### GitHub Integration

```http
GET    /api/github/login               # Start OAuth flow
GET    /api/github/callback            # OAuth callback
GET    /api/github/repos               # List user repos
GET    /api/github/file                # Get file content (raw)
POST   /api/github/index-repo          # Index repo for RAG
```

### Code Review

```http
POST   /api/review                     # Submit code for review
GET    /api/review/{id}                # Get review results
GET    /api/review/history             # User's review history
DELETE /api/review/{id}                # Delete review
```

**POST /api/review Request:**

```json
{
  "code": "def hello():\n    print('world')",
  "language": "python",
  "focus": ["security", "performance", "style"],
  "context": "This is a utility function"
}
```

**Response:**

```json
{
  "id": "rev_12345",
  "issues": [
    {
      "line": 1,
      "severity": "info",
      "type": "style",
      "message": "Add docstring",
      "suggestion": "def hello():\n    \"\"\"Print hello world.\"\"\"\n    print('world')"
    }
  ],
  "score": 78,
  "analyzed_at": "2024-01-15T10:30:00Z"
}
```

### Resumes

```http
POST   /api/resume/upload              # Upload resume (PDF/DOCX/TXT)
GET    /api/resume/{id}                # Get resume content
POST   /api/resume/{id}/analyze        # AI analysis
GET    /api/resume/history             # User's resumes
```

### Jobs

```http
GET    /api/jobs                       # List jobs (paginated)
GET    /api/jobs/{id}                  # Job details
POST   /api/jobs/{id}/apply            # Submit application
GET    /api/jobs/search                # Search by keyword
```

**Query Parameters:**

```
GET /api/jobs?source=linkedin&page=1&limit=20&sort=posted_at
```

### Subscriptions

```http
GET    /api/subscription/status        # Current tier
GET    /api/subscription/plans         # Available plans
POST   /api/subscription/upgrade       # Upgrade plan
POST   /api/stripe/webhook             # Stripe webhook (auto)
```

## 🔐 Authentication Flow

### OAuth 2.0 (GitHub)

```
User clicks "Login with GitHub"
    ↓
/api/auth/login redirects to GitHub
    ↓
User approves, GitHub redirects to /api/github/callback
    ↓
API gets auth code, exchanges for access token
    ↓
Encrypts token (Fernet), stores in DB
    ↓
Generates JWT, returns to frontend
    ↓
Frontend uses JWT in Authorization header for all requests
```

### JWT Flow

```
Client: POST /api/auth/login
        {"email": "user@example.com", "password": "..."}

Server: Verifies credentials, generates JWT
        {"access_token": "eyJhbGc...", "token_type": "bearer"}

Client: GET /api/review/history
        Authorization: Bearer eyJhbGc...

Server: Verifies JWT, returns user's data
```

## 🔑 Authorization Headers

```bash
# All protected endpoints require:
Authorization: Bearer {jwt_token}

# Example:
curl -H "Authorization: Bearer eyJhbGc..." \
     http://localhost:8000/api/review/history
```

## 💾 Database Schema

### users
```sql
id              UUID PRIMARY KEY
email           VARCHAR UNIQUE NOT NULL
password_hash   VARCHAR NOT NULL (if email auth)
github_id       INTEGER UNIQUE (if GitHub auth)
github_token    BYTEA (encrypted)
created_at      TIMESTAMP
```

### code_reviews
```sql
id              VARCHAR PRIMARY KEY
user_id         UUID FOREIGN KEY
code            TEXT
language        VARCHAR
issues          JSONB
score           INT
analysis_time   FLOAT
created_at      TIMESTAMP
```

### jobs
```sql
id              VARCHAR PRIMARY KEY
title           VARCHAR NOT NULL
company         VARCHAR NOT NULL
description     TEXT
url             VARCHAR
source          VARCHAR (linkedin, indeed, etc)
posted_at       TIMESTAMP
```

### subscriptions
```sql
id              VARCHAR PRIMARY KEY
user_id         UUID FOREIGN KEY
tier            VARCHAR (free, pro, enterprise)
stripe_id       VARCHAR
active          BOOLEAN
```

## 🔐 Environment Variables

### Required

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
GITHUB_CLIENT_ID=your_id
GITHUB_CLIENT_SECRET=your_secret
JWT_SECRET=min_32_chars_long_secret_here
GITHUB_TOKEN_ENCRYPTION_KEY=<Fernet key from cryptography>
```

### Optional

```bash
REDIS_URL=redis://localhost:6379/0              # Cache layer
FRONTEND_URL=http://localhost:3000              # CORS
STRIPE_SECRET_KEY=sk_test_...                   # Payments
MODEL_PATH=/app/models/qwen...gguf              # Neural Gen
CODEBERT_ONNX_PATH=/app/models/codebert.onnx   # Analysis
RATE_LIMIT_REQUESTS=100                         # Per minute
RATE_LIMIT_PERIOD=60                            # Seconds
```

## 🐳 Docker

### Build & Run

```bash
docker build -t repo-sense-api:latest .

docker run -d \
  --name repo-sense-api \
  -p 8000:8000 \
  -e DATABASE_URL=postgresql://db:5432/... \
  -e GITHUB_CLIENT_ID=xxx \
  -e GITHUB_CLIENT_SECRET=xxx \
  -e JWT_SECRET=xxx \
  repo-sense-api:latest
```

### Docker Compose

```yaml
api:
  build: ./services
  ports:
    - "8000:8000"
  environment:
    DATABASE_URL: postgresql://postgres:postgres@db:5432/internship_db
    REDIS_URL: redis://redis:6379/0
    GITHUB_CLIENT_ID: ${GITHUB_CLIENT_ID}
    GITHUB_CLIENT_SECRET: ${GITHUB_CLIENT_SECRET}
  depends_on:
    - db
    - redis
    - neural-generator
    - rag-service
```

## 📊 Performance & Rate Limiting

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

## 🆘 Troubleshooting

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

## 📈 Monitoring

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

## 🧪 Testing

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

## 🚀 Deployment

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

## 📖 Related Services

- **Frontend**: [apps/web/README.md](../../apps/web/README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](../neural-generator/README.md)
- **RAG Service**: [services/api/rag/README.md](../rag/README.md)
- **Crawler**: [services/api/crawler/README.md](../crawler/README.md)

## 📄 License

Part of Repo Sense project

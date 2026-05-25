#  RepoSense Backend Services

> Complete microservices architecture for the AI-powered code review and job intelligence platform. Built with FastAPI, PostgreSQL, and integrated ML/NLP capabilities.

## Architecture Overview

RepoSense backend comprises **4 specialized FastAPI microservices** that work together to provide intelligent code analysis, job aggregation, and AI-driven insights:

```
┌─────────────────────────────────────────────────────┐
│        FastAPI Gateway (Port 8000)                  │
│    - Unified routing & rate limiting                │
│    - Auth middleware & session management           │
│    - Swagger/OpenAPI documentation                  │
└──────────┬──────────────────┬──────────────────────┘
           │                  │
    ┌──────▼────────────┬─────▼──────────────┬──────────────────┐
    │                   │                    │                  │
┌───▼────────────┐ ┌──▼──────────┐ ┌────────▼──────┐ ┌──────────▼───┐
│ Main API       │ │   Crawler   │ │     RAG       │ │ Neural Gen   │
│ (Port 8000)    │ │  (Port 8003)│ │   (Port 8002) │ │ (Port 8001)  │
│                │ │             │ │               │ │              │
│ ├─ Auth        │ │ - LinkedIn  │ │ - Indexing    │ │ - LLM        │
│ ├─ GitHub API  │ │ - Indeed    │ │ - Embeddings  │ │ - Generation │
│ ├─ Code Review │ │ - Scrapers  │ │ - FAISS       │ │ - Inference  │
│ ├─ Resume      │ │ - Normalization│ - Chunking  │ │              │
│ ├─ Jobs        │ │ - Dedup     │ │ - Search      │ │              │
│ └─ Subscribe   │ │             │ │               │ │              │
└────┬───────────┘ └────┬────────┘ └────┬──────────┘ └──────┬───────┘
     │                  │                │                  │
     │                  └────────────────┴──────────────────┘
     │
     └─────────────────────┬──────────────────────────────
                           │
                ┌──────────▼──────────┐
                │  PostgreSQL        │
                │  ├─ users          │
                │  ├─ jobs           │
                │  ├─ resumes        │
                │  ├─ subscriptions  │
                │  └─ repo_docs      │
                └───────────────────┘
```

## Service Overview

| Service | Port | Purpose | Tech |
|---------|------|---------|------|
| **Main API** | 8000 | Gateway, auth, code review, jobs, resume | FastAPI, JWT |
| **Crawler** | 8003 | Scrape job boards (9+ sites) | Playwright, BeautifulSoup |
| **RAG** | 8002 | Semantic search & embeddings | FAISS, sentence-transformers |
| **Neural Generator** | 8001 | Local LLM text generation | llama-cpp-python, Qwen GGUF |

## Quick Start

### Prerequisites

```bash
# Required
- Python 3.11+
- PostgreSQL 12+
- pip & virtualenv

# Optional but Recommended
- Docker & Docker Compose
- Redis (for caching)
- Git
```

### Installation (5 minutes)

```bash
# 1. Navigate to services directory
cd services

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# OR
venv\Scripts\activate              # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create .env configuration
cat > .env << EOF
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=10

# Cache (Optional)
REDIS_URL=redis://localhost:6379/0

# Authentication
JWT_SECRET=your_secret_key_minimum_32_characters_long
GITHUB_CLIENT_ID=your_github_oauth_app_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_secret
GITHUB_REDIRECT_URI=http://localhost:3000/api/github/callback

# Encryption
GITHUB_TOKEN_ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

# Frontend
FRONTEND_URL=http://localhost:3000

# Models
MODEL_PATH=/app/models/qwen3-codersmall-0.8b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx

# Stripe (Optional)
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Crawler
SCRAPER_DEBUG=false
MAX_WORKERS=4
REQUEST_TIMEOUT=30
EOF

# 5. Initialize database
python run_migrations.py

# 6. Start the API server
python app.py
```

**API Available at:** http://localhost:8000  
**Swagger Docs:** http://localhost:8000/docs  
**ReDoc:** http://localhost:8000/redoc

### Using Docker Compose

```bash
# Start all services with Docker
docker-compose -f ../infrastructure/docker/docker-compose.yml up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## Directory Structure

```
services/
├── README.md                          # This file
├── app.py                             # Main entry point
├── entrypoint.sh                      # Docker startup script
├── requirements.txt                   # Python dependencies
├── Dockerfile                         # Backend container image
├── nixpacks.toml                      # Railway deployment config
├── .env.example                       # Environment template
│
├── api/                               # 🔌 Main FastAPI Application
│   ├── README.md                      # API documentation
│   ├── src/
│   │   ├── app.py                     # FastAPI instance factory
│   │   ├── routes/
│   │   │   ├── auth.py                # Login, GitHub OAuth
│   │   │   ├── github.py              # GitHub API integration
│   │   │   ├── review.py              # Code review endpoints
│   │   │   ├── jobs.py                # Job listing search
│   │   │   ├── resume.py              # Resume upload & parse
│   │   │   └── subscription.py        # Stripe webhooks
│   │   ├── services/
│   │   │   ├── ai_service.py          # Review orchestration
│   │   │   ├── analysis_engine.py     # CodeBERT & regex analysis
│   │   │   ├── github_service.py      # GitHub API client
│   │   │   ├── resume_service.py      # Resume parsing
│   │   │   └── stripe_service.py      # Stripe integration
│   │   ├── middleware/
│   │   │   └── auth.py                # JWT verification
│   │   ├── configs/
│   │   │   ├── config.py              # Unified Pydantic settings
│   │   │   ├── db.py                  # PostgreSQL connection pool
│   │   │   └── redis.py               # Redis client
│   │   ├── schemas/                   # Pydantic DTOs
│   │   │   ├── auth.py                # Auth request/response
│   │   │   ├── code_review.py         # Review submission DTOs
│   │   │   ├── job.py                 # Job listing schema
│   │   │   └── resume.py              # Resume upload schema
│   │   ├── utils/
│   │   │   ├── crypto.py              # Fernet token encryption
│   │   │   ├── logger.py              # Structured logging
│   │   │   └── validators.py          # Input validation
│   │   └── models/                    # ML model wrappers
│   │       ├── codebert_tokenizer/
│   │       └── codebert_quantized.onnx
│   │
│   ├── crawler/                       # Job Aggregator (9+ sites)
│   │   ├── README.md                  # Crawler documentation
│   │   ├── src/
│   │   │   ├── index.py               # Main orchestrator
│   │   │   ├── config.py              # Crawler settings
│   │   │   ├── utils.py               # Helpers & DB client
│   │   │   ├── scrapers/
│   │   │   │   ├── base.py            # Base scraper class
│   │   │   │   ├── linkedin.py        # LinkedIn Jobs
│   │   │   │   ├── indeed.py          # Indeed
│   │   │   │   ├── naukri.py          # Naukri (India)
│   │   │   │   ├── internshala.py     # Internshala
│   │   │   │   ├── wellfound.py       # Wellfound
│   │   │   │   ├── unstop.py          # Unstop
│   │   │   │   ├── glassdoor.py       # Glassdoor
│   │   │   │   └── cutshort.py        # Cutshort
│   │   │   └── processors/
│   │   │       └── normalize.py       # Data normalization
│   │   ├── requirements.txt
│   │   └── Dockerfile
│   │
│   ├── neural_generator/              # LLM Service (Port 8001)
│   │   ├── README.md                  # LLM documentation
│   │   ├── src/
│   │   │   └── app.py                 # FastAPI microservice
│   │   ├── models/
│   │   │   └── qwen3-0.6b-q4_k_m.gguf # Quantized model (~400MB)
│   │   ├── requirements.txt
│   │   ├── Dockerfile
│   │   └── nixpacks.toml
│   │
│   └── rag/                           #  RAG Service (Port 8002)
│       ├── README.md                  # RAG documentation
│       ├── src/
│       │   ├── app.py                 # FastAPI microservice
│       │   ├── services/
│       │   │   ├── indexer.py         # Repository indexing
│       │   │   ├── vector_store.py    # FAISS index management
│       │   │   ├── embedder.py        # Sentence-transformers
│       │   │   └── generator.py       # Neural Gen integration
│       │   └── schemas/
│       │       └── models.py          # Pydantic models
│       ├── indices/                   # FAISS indices (persisted)
│       │   ├── index.faiss
│       │   └── metadata.pkl
│       ├── requirements.txt
│       ├── Dockerfile
│       └── nixpacks.toml
│
├── models/                            # Cached ML Models
│   ├── codebert_quantized.onnx        # CodeBERT (~500MB)
│   ├── codebert_tokenizer.json        # Tokenizer config
│   └── qwen3-codersmall-0.8b.gguf     # Qwen LLM (~400MB)
│
└── test_imports.py                    # Dependency validation
```

## API Endpoints

### Authentication
- `POST /api/auth/github/login` – Initiate GitHub OAuth
- `GET /api/auth/github/callback` – OAuth callback handler
- `POST /api/auth/logout` – Logout & invalidate token
- `GET /api/auth/me` – Get current user

### Code Review
- `POST /api/review/submit` – Submit code for analysis
- `GET /api/review/{review_id}` – Retrieve review results
- `POST /api/review/{review_id}/autofix` – Generate fixes
- `GET /api/review/history` – List user's reviews

### Jobs
- `GET /api/jobs/search` – Search jobs with filters
- `GET /api/jobs/{job_id}` – Get job details
- `POST /api/jobs/match` – Match resume to jobs

### Resume
- `POST /api/resume/upload` – Upload & parse resume
- `GET /api/resume/{resume_id}` – Get parsed resume
- `POST /api/resume/{resume_id}/analyze` – AI analysis

### GitHub
- `GET /api/github/repos` – List user's repositories
- `GET /api/github/{repo}/files` – Browse repo files
- `POST /api/github/{repo}/auto-setup` – Generate README

### Subscriptions
- `GET /api/subscription/status` – Check tier & limits
- `POST /api/subscription/checkout` – Create Stripe session
- `POST /api/webhook/stripe` – Stripe webhook

**Full API Docs:** Visit http://localhost:8000/docs

## Service Documentation

### API Service (`services/api/src/`)

Main FastAPI application.

**Key Endpoints:**

```
AUTH
  POST   /api/auth/register           Register user
  POST   /api/auth/login              Email login
  GET    /api/auth/me                 Current user

GITHUB
  GET    /api/github/login            Start OAuth
  GET    /api/github/callback         OAuth callback
  GET    /api/github/repos            List repos
  GET    /api/github/file             Get file content
  POST   /api/github/index-repo       Index for RAG

CODE REVIEW
  POST   /api/review                  Submit code
  GET    /api/review/{id}             Get results

RESUMES
  POST   /api/resume/upload           Upload file
  GET    /api/resume/{id}             Get resume
  POST   /api/resume/{id}/analyze     AI analysis

JOBS
  GET    /api/jobs                    List jobs
  POST   /api/jobs/{id}/apply         Apply

SUBSCRIPTIONS
  GET    /api/subscription/status     Check tier
  POST   /api/subscription/upgrade    Upgrade
```

**Architecture:**

- Request → Middleware (Auth, Rate Limit) → Route Handler → Service → Database
- Async/await throughout for high performance
- Optional Redis caching for reviews (5 min TTL)

### Crawler Service (`services/api/crawler/`)

Automated job scraper for 9+ job sites.

**Supported Sites:**
- LinkedIn, Indeed, Naukri, Internshala, Wellfound
- Unstop, Glassdoor, Cutshort, Company Portals

**Running:**

```bash
cd services/api/crawler/src
python index.py                                    # Default
python index.py --scrapers linkedin indeed --max-pages 5  # Custom
```

**Pipeline:** Scrape → Normalize → Deduplicate → Enrich → Store

### Neural Generator (`services/api/neural-generator/`)

**llama-cpp-python** service for Qwen GGUF text generation.

**Endpoints:**

```
POST /generate
  { prompt: str, max_tokens: 512, temperature: 0.2 }

GET /health
```

**Running:**

```bash
cd services/api/neural-generator
python -m uvicorn src.app:app --host 0.0.0.0 --port 8001
```

**Model:** Qwen3-0.6B Q4_K_M GGUF (~400MB, CPU-only, 2 threads)

### RAG Service (`services/api/rag/`)

Retrieval-Augmented Generation for README generation.

**Endpoints:**

```
POST /api/rag/index          Index repo files
POST /api/rag/generate       Generate README
GET  /api/rag/search         Search indexed files
```

**Architecture:** Files → Embeddings → FAISS Index → Retriever → LLM

## Environment Variables

### Required

```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/db
GITHUB_CLIENT_ID=xxxx
GITHUB_CLIENT_SECRET=xxxx
JWT_SECRET=your_secret_min_32_chars
GITHUB_TOKEN_ENCRYPTION_KEY=<Fernet key>
```

### Optional

```bash
REDIS_URL=redis://localhost:6379/0
STRIPE_SECRET_KEY=sk_test_xxx
AWS_ACCESS_KEY=xxx
MODEL_PATH=/app/models/qwen3-0.6b-q4_k_m.gguf
CODEBERT_ONNX_PATH=/app/models/codebert_quantized.onnx
SCRAPER_DEBUG=false
```

## Database

**Tables:**
- `users` - User accounts & GitHub tokens (encrypted)
- `jobs` - Job postings (id, title, company, description, url, source, posted_at)
- `resumes` - Resume uploads with AI analysis
- `subscriptions` - Payment records
- `repo_docs` - Generated READMEs

**Migrations:** `database/migrations/*.sql`

## Docker

### Development

```bash
docker-compose up -d
docker-compose logs -f api
docker-compose down
```

### Production

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Testing

```bash
pytest tests/
pytest tests/ --cov=api
pytest tests/test_imports.py
```

## Performance

| Feature | Details |
|---------|---------|
| **Caching** | Redis (5 min TTL for reviews) |
| **Rate Limit** | 100 req/min per IP (500 for auth users) |
| **Async** | All endpoints use async/await |
| **DB Pool** | 5 max connections |

## Deployment

### Railway.app (Free tier friendly)

```bash
railway link
railway deploy
```

### Traditional VPS

```bash
sudo systemctl start repo-sense-api
sudo journalctl -u repo-sense-api -f
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API won't start | Run: `pytest tests/test_imports.py` |
| Database connection fails | Check `DATABASE_URL` env var |
| Redis unavailable | Optional; app works without it |
| Encryption key invalid | Regenerate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| Migrations fail | Drop tables: `DROP TABLE ... CASCADE;` |

## Related Docs

- **Frontend**: [apps/web/README.md](../apps/web/README.md)
- **Neural Generator**: [services/api/neural-generator/README.md](./api/neural-generator/README.md)
- **RAG**: [services/api/rag/README.md](./api/rag/README.md)
- **Crawler**: [services/api/crawler/README.md](./api/crawler/README.md)

## Swagger Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI JSON**: http://localhost:8000/openapi.json

## Features

- OAuth 2.0 GitHub login
- JWT stateless authentication
- Code review with AI analysis
- Auto-fix suggestions
- 9+ job site scraping
- RAG-powered documentation
- Rate limiting and caching
- Async/high performance
- Stripe payments
- Free tier AWS t2.micro compatible

## License

Part of Repo Sense project

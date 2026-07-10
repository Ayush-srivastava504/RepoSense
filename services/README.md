# RepoSense Backend Services

> Backend for the AI-powered job platform, resume/LinkedIn intelligence, and code review tooling. Built with FastAPI, PostgreSQL, and local ML/NLP inference (no third-party AI APIs for core inference).

## Architecture Overview

The backend is **one Core API plus three sub-services that live inside it** (`services/api/crawler`, `services/api/rag`, `services/api/neural_generator`). The crawler is a batch job, not an always-on HTTP service; RAG and Neural Generator are persistent FastAPI microservices that the Core API calls over HTTP.

```
┌───────────────────────────────────────────────────┐
│         Core API — FastAPI (Port 8000)            │
│  auth · github · jobs · resume · linkedin ·        │
│  subscription · webhooks · async-jobs ·            │
│  /api/v1/review, /api/v1/fix, /api/v1/self-healing │
└──────┬─────────────────────┬───────────────────────┘
       │ HTTP                │ HTTP
┌──────▼──────────┐   ┌──────▼──────────┐
│ RAG (Port 8001) │   │ Neural Gen      │
│ FAISS + embed   │──►│ (Port 8002)     │
│                 │   │ Qwen3-0.6B GGUF │
└─────────────────┘   └─────────────────┘

┌─────────────────────────────────────────┐
│ Crawler — batch CLI job, not an HTTP     │
│ service. Run manually / on a schedule.   │
└─────────────────────────────────────────┘

              ┌──────────────────┐
              │   PostgreSQL     │
              │ users, jobs,     │
              │ resumes, subs,   │
              │ repo_docs, +7    │
              │ more (12 total   │
              │ migrations)      │
              └──────────────────┘
```

## Service Overview

| Service | Port | Type | Purpose | Tech |
|---|---|---|---|---|
| **Core API** | 8000 | Persistent HTTP | Auth, jobs, resume, LinkedIn, subscriptions, code review | FastAPI, JWT |
| **RAG** | 8001 | Persistent HTTP | Semantic search & README generation | FAISS, sentence-transformers |
| **Neural Generator** | 8002 | Persistent HTTP | Local LLM text generation | llama-cpp-python, Qwen3-0.6B GGUF |
| **Crawler** | — | Batch CLI job | Scrape 9+ job boards into Postgres | Playwright, httpx, BeautifulSoup |

Port numbers above match `infrastructure/docker/docker-compose.yml` and `configs/config.py`'s defaults (`RAG_SERVICE_URL=http://localhost:8001`, `NEURAL_GENERATOR_URL=http://localhost:8002`). Older docs that list RAG on 8002 and Neural Generator on 8001, or the crawler on 8003, are describing a port layout that no longer matches the code.

## Quick Start

### Prerequisites

```
Required:
- Python 3.11+
- PostgreSQL 15 (12+ works)
- pip & virtualenv

Optional but recommended:
- Docker & Docker Compose
- Redis
```

### Installation

```bash
# 1. Navigate to the API service (this is the actual backend root)
cd services/api

# 2. Create virtual environment
python -m venv venv
source venv/bin/activate          # Linux/Mac
# venv\Scripts\activate           # Windows

# 3. Install dependencies
pip install -r requirements.txt

# 4. Create your .env — there is no committed .env.example.
#    config.py resolves the env file from services/api/src/configs/../../../../.env,
#    i.e. the repo root. Minimum required values:
cat > ../../.env << 'EOF'
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_secret_key_minimum_32_characters_long
GITHUB_CLIENT_ID=your_github_oauth_app_id
GITHUB_CLIENT_SECRET=your_github_oauth_app_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=REPLACE_WITH_FERNET_KEY
FRONTEND_URL=http://localhost:3000
RAG_SERVICE_URL=http://localhost:8001
NEURAL_GENERATOR_URL=http://localhost:8002
RAZORPAY_KEY_ID=rzp_test_xxx
RAZORPAY_KEY_SECRET=xxx
EMAIL_PROVIDER=resend
RESEND_API_KEY=xxx
EOF

# Generate a Fernet key for GITHUB_TOKEN_ENCRYPTION_KEY:
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# 5. Initialize the database (runs all 12 migrations)
python run_migrations.py

# 6. Start the Core API
uvicorn src.app:app --reload --port 8000
```

**API:** http://localhost:8000 · **Swagger:** http://localhost:8000/docs · **ReDoc:** http://localhost:8000/redoc

### Using Docker Compose

```bash
docker-compose -f ../infrastructure/docker/docker-compose.yml up -d
docker-compose -f ../infrastructure/docker/docker-compose.yml logs -f api
docker-compose -f ../infrastructure/docker/docker-compose.yml down
```

This also starts `postgres`, `redis`, `rag`, `neural-generator`, and runs the `crawler` once against all 9 scrapers before it exits.

## Directory Structure

```
services/
├── README.md
├── app.py                              # Thin launcher that runs services/api
├── Pyproject.toml
│
└── api/                                 # The actual backend root
    ├── README.md
    ├── requirements.txt
    ├── Dockerfile
    ├── entrypoint.sh                    # Docker container startup script
    ├── run_migrations.py                # Runs all 12 migrations in order
    ├── monitor.py                       # Standalone health/metrics monitor
    ├── test_imports.py                  # Validates every backend module imports cleanly
    │
    ├── database/migrations/             # 001_users.sql … 012_guest_users.sql
    │
    ├── src/
    │   ├── core/app.py                  # create_application() — the real FastAPI factory
    │   ├── routes/
    │   │   ├── auth.py                  # OTP request/verify, guest sessions
    │   │   ├── github.py                # OAuth connect, repo browser, terminal token
    │   │   ├── jobs.py                  # Job search/listing
    │   │   ├── resume.py                # Resume generation & CRUD
    │   │   ├── linkedin.py              # LinkedIn Profile Optimizer (premium)
    │   │   ├── subscription.py          # Razorpay checkout + webhook
    │   │   ├── webhooks.py              # GitHub push webhook
    │   │   └── async_jobs.py            # GET /api/async-jobs/{id} — poll background jobs
    │   ├── api/
    │   │   ├── routes.py                # /api/v1/review, /api/v1/fix
    │   │   └── routes_self_healing.py   # /api/v1/self-healing/fix-and-validate
    │   ├── services/
    │   │   ├── ai_service.py            # Review/auto-fix orchestration
    │   │   ├── analysis_engine.py       # CodeBERT-based static analysis
    │   │   ├── auto_fixer.py            # LLM-driven auto-fix
    │   │   ├── validation_engine.py     # Validates fixed code (self-healing)
    │   │   ├── github_service.py        # GitHub API client
    │   │   ├── resume_service.py, resume_ai_service.py,
    │   │   │   resume_pdf_service.py, resume_template_service.py
    │   │   ├── linkedin_service.py, linkedin_ai_service.py, linkedin_rules.py
    │   │   ├── subscription_service.py  # Razorpay integration
    │   │   ├── job_queue.py             # Async job creation/polling backing store
    │   │   ├── email_service.py         # Resend-based OTP delivery
    │   │   └── terminal_manager.py      # WebSocket terminal session state
    │   ├── middleware/
    │   │   ├── auth.py                  # JWT verification (verify_token dependency)
    │   │   └── rate_limit.py
    │   ├── configs/
    │   │   ├── config.py, settings.py   # Pydantic Settings (duplicated — see note below)
    │   │   ├── db.py                    # asyncpg connection pool
    │   │   ├── redis.py                 # Redis client
    │   │   └── ml_config.py             # CodeBERT model config
    │   ├── schemas/models.py
    │   └── utils/
    │       ├── crypto.py                # Fernet token encryption
    │       ├── logger.py
    │       └── model_downloader.py      # HF Hub model download/caching
    │
    ├── crawler/                          # Job Aggregator (9+ sites) — see its own README
    ├── rag/                              # RAG microservice — see its own README
    ├── neural_generator/                 # LLM inference microservice — see its own README
    └── templates/resume_template.tex     # LaTeX resume template
```

> **Note:** `configs/config.py` and `configs/settings.py` currently define the exact same `Settings` class. This looks like leftover duplication from a refactor rather than an intentional split — worth consolidating, but both are imported from in different places today (`config.py` is the one actually wired into `core/app.py`).

## API Endpoints

Full endpoint reference lives in the [root README](../README.md#core-api-endpoints). Summary:

### Auth
- `POST /api/auth/otp/request`, `POST /api/auth/otp/verify` — email OTP login (no passwords)
- `POST /api/auth/guest` — anonymous session

### GitHub
- `GET /api/github/login`, `/callback`, `/exchange`, `POST /disconnect`
- `GET /api/github/repos`, `/contents`, `/file`
- `POST /api/github/{owner}/{repo}/auto-setup` — RAG-generated README
- `POST /api/github/terminal/token`

### Code Review
- `POST /api/v1/review`, `POST /api/v1/fix`
- `POST /api/v1/self-healing/fix-and-validate`

### Jobs
- `GET /api/jobs/`, `/featured`, `/{job_id}`

### Resume
- `POST /api/resume/generate`, `/generate-structured`, `/create`
- `GET /api/resume/list`

### LinkedIn Optimizer
- `GET /api/linkedin/status`, `POST /unlock/ad`, `POST /analyze`, `GET /history`

### Subscriptions (Razorpay)
- `POST /api/subscription/create-checkout`, `POST /webhook`, `GET /status`

### Async Jobs
- `GET /api/async-jobs/{job_id}`

### Webhooks
- `POST /api/webhooks/github`

There is no `/api/review/history`, `/api/jobs/match`, `/api/jobs/{id}/apply`, or `/api/auth/register` / `/api/auth/login` in the current code — those endpoints from earlier docs have been removed or never shipped.

## Sub-Services

### Crawler (`services/api/crawler/`)
9+ scrapers: LinkedIn, HiringCafe, Internshala, Unstop, Cutshort, and direct company portals.

```bash
cd services/api/crawler
python src/index.py --scrapers linkedin,hiringcafe --max-pages 5
```

Pipeline: scrape → normalize → deduplicate → enrich → trust/rank → store in Postgres. See [services/api/crawler/README.md](./api/crawler/README.md).

### Neural Generator (`services/api/neural_generator/`)
`llama-cpp-python` running **Qwen3-0.6B-Q4_K_M GGUF**, CPU-only.

```bash
cd services/api/neural_generator
uvicorn src.app:app --host 0.0.0.0 --port 8002
```

See [services/api/neural_generator/README.md](./api/neural_generator/README.md).

### RAG (`services/api/rag/`)

```bash
cd services/api/rag
uvicorn src.app:app --host 0.0.0.0 --port 8001
```

Endpoints: `POST /api/rag/index`, `POST /api/rag/generate`, `GET /health`. See [services/api/rag/README.md](./api/rag/README.md).

## Environment Variables

### Required
```
DATABASE_URL
JWT_SECRET
GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET / GITHUB_REDIRECT_URI
GITHUB_TOKEN_ENCRYPTION_KEY
```

### Used in practice (optional but needed for those features)
```
REDIS_URL
RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET     # NOT Stripe — migrated in 007_migrate_stripe_to_razorpay.sql
RESEND_API_KEY / EMAIL_PROVIDER            # OTP delivery
AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / AWS_REGION / S3_BUCKET
RAG_SERVICE_URL / NEURAL_GENERATOR_URL
CORS_ORIGINS
REQUIRE_AUTH
```

No current code reads `STRIPE_SECRET_KEY`, `CODEBERT_ONNX_PATH`, or `DATABASE_POOL_SIZE`/`DATABASE_MAX_OVERFLOW` — those were either replaced (Stripe→Razorpay, ONNX→HF Transformers) or never implemented.

## Database

**12 migrations**, run via `python services/api/run_migrations.py` (not `make migrate`, which is stale and only runs the first 4):

| # | File | Adds |
|---|---|---|
| 001 | `001_users.sql` | `users` |
| 002 | `002_resumes.sql` | `resumes` |
| 003 | `003_jobs.sql` | `jobs` |
| 004 | `004_subscriptions.sql` | `subscriptions` |
| 005 | `005_repo_docs.sql` | `repo_docs` |
| 006 | `006_subscriptions_unique_constraint.sql` | Unique constraint on `subscriptions` |
| 007 | `007_migrate_stripe_to_razorpay.sql` | Stripe → Razorpay column migration |
| 008 | `008_otp_auth.sql` | Email OTP auth columns |
| 009 | `009_async_jobs.sql` | Async job queue table |
| 010 | `010_linkedin_optimizer.sql` | LinkedIn optimizer tables |
| 011 | `011_job_trust_and_ranking.sql` | Job trust/ranking columns |
| 012 | `012_guest_users.sql` | Guest user support |

## Testing

```bash
pytest tests/ -v                          # from repo root
python services/api/test_imports.py       # validates backend imports
```

There is no `tests/test_imports.py`, `pytest --cov=api`, `test_api.py`, or similar suite beyond `tests/test_basic.py` and `services/api/test_imports.py` today.

## Deployment

No Railway or Terraform config is currently committed in this repo. See [docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) for the supported Docker Compose path and notes on what would be needed to add cloud deployment tooling.

## Troubleshooting

| Issue | Solution |
|---|---|
| API won't start | Run `python services/api/test_imports.py` to isolate the failing import |
| Database connection fails | Check `DATABASE_URL` |
| Redis unavailable | Optional — the app degrades gracefully (`/health/detailed` reports `redis: disconnected`) |
| Encryption key invalid | Regenerate: `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"` |
| Migrations fail partway | Migrations aren't idempotent by default — check `run_migrations.py` output for which one failed before retrying |

## Related Docs

- Frontend: [apps/web/README.md](../apps/web/README.md)
- Core API: [services/api/README.md](./api/README.md)
- Crawler: [services/api/crawler/README.md](./api/crawler/README.md)
- RAG: [services/api/rag/README.md](./api/rag/README.md)
- Neural Generator: [services/api/neural_generator/README.md](./api/neural_generator/README.md)


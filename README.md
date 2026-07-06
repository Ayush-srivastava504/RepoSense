# RepoSense – AI-Powered Job Platform, Resume Intelligence & Code Review

## Overview

RepoSense is a full-stack platform combining job aggregation, AI resume/LinkedIn tooling, and automated code review. It's a monorepo with one Next.js frontend and four independent Python backend services:

- **Job Crawler** – scrapes 9+ job boards (LinkedIn, Indeed, Naukri, Internshala, Wellfound, Unstop, Glassdoor, Cutshort, plus direct company career portals) and normalizes/dedupes/enriches results into Postgres
- **Core API** – FastAPI service handling auth, jobs, resumes, LinkedIn optimization, subscriptions, GitHub integration, and AI code review/auto-fix
- **RAG Service** – FAISS-backed semantic search over indexed repo code, used to generate context-grounded READMEs
- **Neural Generator** – local CPU inference on a quantized Qwen3-0.6B GGUF model (via llama-cpp-python) for text/README generation
- **Web App** – Next.js 14 frontend: job search, resume builder, LinkedIn profile optimizer, GitHub repo browser with a live terminal, and subscription checkout

> **Note on naming:** the frontend payment module is still named `lib/stripe.ts` for historical reasons, but its contents are 100% Razorpay. The backend migrated from Stripe to Razorpay in migration `007_migrate_stripe_to_razorpay.sql`. There is no Stripe integration anywhere in the current codebase.

## Key Features

- **Multi-Platform Job Aggregation** — 9+ scrapers with retry/backoff, proxy rotation, and a trust/ranking pipeline (`analysis_engine`-adjacent `processors/trust.py`) that tiers listings by company reputation
- **AI-Powered Code Review** — CodeBERT-based static analysis (`analysis_engine.py`) plus an LLM auto-fixer and a "self-healing" endpoint that fixes *and* validates code in one call
- **Resume Builder & AI Analysis** — structured resume generation, LaTeX/PDF rendering, and AI feedback against a target job description
- **LinkedIn Profile Optimizer** (premium feature) — scores a profile against 14 rules and generates a rewritten headline/about via the same local Qwen3 model; free users get one lifetime analysis, extendable via a rewarded ad or a Pro/Enterprise subscription
- **Semantic Search / RAG** — FAISS vector store + sentence-transformers embeddings for retrieval-augmented README generation
- **Email OTP + Guest Auth** — passwordless login via one-time email codes (Resend), with automatic anonymous "guest" JWT sessions so unauthenticated visitors can still save/apply/track before signing up
- **GitHub Integration** — OAuth connect (not the primary login method — see Authentication below), repo browser, a WebSocket-backed in-browser terminal, and auto-generated READMEs via the RAG service
- **Razorpay Subscriptions** — Pro / Enterprise tiers with webhook-verified payments
- **Async Job Queue** — long-running work (resume generation, LinkedIn analysis, README generation) runs as background jobs polled via `/api/async-jobs/{id}`, since local LLM calls can take 30–90s+
- **Docker Compose** — one command brings up Postgres, Redis, the API, RAG, Neural Generator, and the crawler

## Authentication (read this before using the old docs)

Earlier versions of this project used GitHub-OAuth-as-primary-login with password-based `/api/auth/register` and `/api/auth/login` endpoints. **That flow no longer exists.** Current auth is:

| Endpoint | Purpose |
|---|---|
| `POST /api/auth/otp/request` | Send a 6-digit OTP to an email (10 min TTL) |
| `POST /api/auth/otp/verify` | Verify the OTP, returns a 7-day JWT |
| `POST /api/auth/guest` | Mint an anonymous JWT for unauthenticated visitors (no-ops if `REQUIRE_AUTH=true` or a token already exists) |
| `GET /api/github/login` → `/api/github/callback` | **Separate, optional** GitHub OAuth flow used only to connect a GitHub account for the repo browser/terminal/auto-README features — it is not how users sign in to the platform |

## Quick Start

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+
- **PostgreSQL** 15 (or 12+, matches `docker-compose`'s `postgres:15` image)
- **Redis** (optional but recommended — session/rate-limit state)
- **Docker** (optional, but the only supported way to run the RAG + Neural Generator services with their prebuilt model images)

### Local Setup (without Docker)

```bash
# 1. Clone repository
git clone <repo-url>
cd RepoSense-master

# 2. Set up the API service
cd services/api
python -m venv venv
source venv/bin/activate      # Linux/Mac
# venv\Scripts\activate       # Windows
pip install -r requirements.txt

# 3. Configure environment
cp .env.example .env          # if present; otherwise create manually — see docs/MODEL_CONFIGURATION.md
# Set DATABASE_URL, JWT_SECRET, RAZORPAY_KEY_ID/SECRET, RESEND_API_KEY, GITHUB_CLIENT_ID/SECRET, etc.

# 4. Run database migrations
cd ../..
python services/api/run_migrations.py

# 5. Start the API (http://localhost:8000)
cd services/api
uvicorn src.app:app --reload --port 8000

# 6. In separate terminals, start the microservices the API depends on:
cd services/api/neural_generator && pip install -r requirements.txt && uvicorn src.app:app --port 8002
cd services/api/rag              && pip install -r requirements.txt && uvicorn src.app:app --port 8001

# 7. Start the frontend (http://localhost:3000)
cd apps/web
npm install
npm run dev
```

See [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) for full database schema and environment variable details.

### Using Docker (Recommended)

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# View logs for a specific service
docker-compose -f infrastructure/docker/docker-compose.yml logs -f api
```

This starts: `postgres` (5432), `redis` (6379), `neural-generator` (8002), `rag` (8001, depends on neural-generator being healthy), `api` (8000, depends on postgres/redis/rag), and `crawler` (runs once against 9 scrapers, then exits — it's a batch job, not a long-running server).

See [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) for production deployment options.

## Project Structure

```
RepoSense-master/
├── README.md                          # This file
├── LICENSE                            # MIT
├── Makefile                           # dev/build/test/migrate helper targets
├── ci-test.txt                        # CI smoke-test marker file, not project docs
├── apps/
│   ├── OVERVIEW.md                    # Executive summary & architecture
│   └── web/                           # Next.js 14 frontend
│       ├── README.md
│       ├── app/                       # App Router pages
│       │   ├── page.tsx               # Landing page
│       │   ├── about/                 # About page
│       │   ├── jobs/, internships/    # Public job/internship listings + [slug] detail pages
│       │   └── (auth)/                # Routes behind AuthGuard
│       │       ├── login/             # Email OTP login
│       │       ├── register/          # Account creation (OTP-based, not password)
│       │       ├── dashboard/         # Main authenticated dashboard
│       │       ├── github/            # GitHub OAuth connect + repo browser + terminal
│       │       ├── linkedin/          # LinkedIn Profile Optimizer
│       │       └── resume/builder/    # Resume builder
│       ├── app/components/            # AdSlot, AppShell, JobCard, CommitGraph3D, Terminal, etc.
│       └── lib/                       # api.ts, auth.ts (OTP + guest), jobs.ts, stripe.ts (→ Razorpay), featureFlags.ts
│
├── docs/
│   ├── SETUP_GUIDE.md                 # Full setup + database schema
│   ├── SETUP_COMPLETE.md              # Model quick-start
│   ├── MODEL_CONFIGURATION.md         # Environment variable reference for ML models
│   ├── COMPLETE_MODEL_MIGRATION_GUIDE.md  # Historical: local-weights → Hugging Face Hub migration
│   └── DEPLOYMENT_GUIDE.md            # Production deployment (Docker/Railway/manual)
│
├── infrastructure/docker/
│   └── docker-compose.yml             # postgres, redis, neural-generator, rag, api, crawler
│
├── services/
│   ├── README.md                      # Backend microservices guide
│   ├── app.py                         # Convenience entrypoint that launches services/api
│   └── api/                           # Core FastAPI application (the actual backend root)
│       ├── README.md
│       ├── requirements.txt
│       ├── run_migrations.py          # Runs all 12 migrations in services/api/database/migrations/
│       ├── database/migrations/       # 001_users.sql … 012_guest_users.sql
│       ├── entrypoint.sh              # Docker container startup script
│       ├── monitor.py                 # Standalone health/metrics monitor
│       ├── src/
│       │   ├── core/app.py            # FastAPI app factory — this is the real app entrypoint
│       │   ├── configs/               # config.py (Pydantic Settings), db.py, redis.py, ml_config.py
│       │   ├── middleware/            # auth.py (JWT), rate_limit.py
│       │   ├── routes/                # auth, github, jobs, resume, linkedin, subscription, webhooks, async_jobs
│       │   ├── api/                   # routes.py (code review), routes_self_healing.py
│       │   ├── services/              # ai_service, analysis_engine, auto_fixer, resume_*, linkedin_*, job_queue, github_service, subscription_service, email_service, etc.
│       │   ├── schemas/, utils/
│       │
│       ├── crawler/                   # Job scraper microservice (9+ sources)
│       │   ├── README.md
│       │   └── src/{index.py, config.py, scrapers/, processors/, utils.py}
│       │
│       ├── neural_generator/          # Local LLM inference microservice
│       │   ├── README.md
│       │   └── src/app.py             # Qwen3-0.6B GGUF via llama-cpp-python
│       │
│       └── rag/                       # Semantic search / README generation microservice
│           ├── README.md
│           └── src/{app.py, routes.py, services/{chunker,embedder,vector_store,generator}.py}
│
└── tests/
    ├── test_basic.py
    └── pytest.ini
```

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind, react-three-fiber | 3D commit graph on the landing page |
| **Terminal** | xterm.js + WebSocket | Live GitHub repo terminal |
| **Backend (Core API)** | FastAPI, Python 3.11+, asyncpg, Pydantic Settings | Port 8000 |
| **RAG Service** | FastAPI, FAISS, sentence-transformers | Port 8001 |
| **Neural Generator** | FastAPI, llama-cpp-python | Port 8002, Qwen3-0.6B-Q4_K_M GGUF, CPU-only |
| **Crawler** | Playwright, httpx, BeautifulSoup, asyncpg | Runs as a batch job, not a persistent server |
| **Code Analysis** | HuggingFace Transformers, CodeBERT (`microsoft/codebert-base`) | Downloaded from HF Hub, cached locally |
| **Database** | PostgreSQL 15 | 12 migrations — see [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) |
| **Cache / Rate Limiting** | Redis | Optional in dev, used for OTP state, rate limiting, restart counters |
| **Auth** | JWT (python-jose) + email OTP (Resend) + guest sessions + optional GitHub OAuth (Fernet-encrypted token storage) | No password auth |
| **Payments** | Razorpay | Not Stripe — see note above |
| **Containers** | Docker, Docker Compose | Prebuilt GHCR images for `neural-generator` and `rag`; `api` builds from `services/api` |

## System Architecture

```
┌────────────────────────────────────────────┐
│  Next.js Frontend (:3000)                  │
│  Jobs · Resume Builder · LinkedIn Optimizer│
│  GitHub Browser + Terminal · Checkout      │
└───────────────────┬─────────────────────────┘
                     │ HTTP / WebSocket
┌────────────────────▼─────────────────────────┐
│  Core API — FastAPI (:8000)                  │
│  auth · github · jobs · resume · linkedin    │
│  subscription · webhooks · async-jobs        │
│  api/v1 review + fix · v1/self-healing       │
└───┬───────────────┬───────────────┬──────────┘
    │               │               │
┌───▼────┐   ┌──────▼──────┐   ┌────▼─────┐
│Postgres│   │RAG (:8001)  │   │Neural Gen│
│Redis   │   │FAISS search │   │(:8002)   │
└────────┘   └──────┬──────┘   │Qwen3-0.6B│
                     └──────────►(shared)  │
                                └──────────┘
      (Crawler is a separate batch job, not
       a request-time dependency of the API)
```

## Core API Endpoints

### Authentication
- `POST /api/auth/otp/request` – Send email OTP
- `POST /api/auth/otp/verify` – Verify OTP → JWT
- `POST /api/auth/guest` – Anonymous guest session

### GitHub
- `GET /api/github/login` / `GET /api/github/callback` / `GET /api/github/exchange` – OAuth connect flow
- `POST /api/github/disconnect`
- `GET /api/github/repos`, `GET /api/github/contents`, `GET /api/github/file`
- `POST /api/github/{owner}/{repo}/auto-setup` – RAG-generated README
- `POST /api/github/terminal/token` – Short-lived token for the WebSocket terminal

### Code Review
- `POST /api/v1/review` – Submit code for CodeBERT-based analysis
- `POST /api/v1/fix` – Auto-fix identified issues
- `POST /api/v1/self-healing/fix-and-validate` – Fix and validate in one call

### Jobs
- `GET /api/jobs/` – Search/list jobs
- `GET /api/jobs/featured`
- `GET /api/jobs/{job_id}`

### Resume
- `POST /api/resume/generate`, `POST /api/resume/generate-structured` – AI resume generation
- `POST /api/resume/create`, `GET /api/resume/list` – CRUD

### LinkedIn Optimizer (premium)
- `GET /api/linkedin/status` – Quota/gate state
- `POST /api/linkedin/unlock/ad` – Redeem a rewarded-ad credit
- `POST /api/linkedin/analyze` – Kicks off analysis (async job)
- `GET /api/linkedin/history`

### Subscriptions (Razorpay)
- `POST /api/subscription/create-checkout` – Create order for `pro` (₹999/mo) or `enterprise` (₹2999/mo)
- `POST /api/subscription/webhook` – HMAC-verified Razorpay webhook
- `GET /api/subscription/status`

### Async Jobs
- `GET /api/async-jobs/{job_id}` – Poll status of a background job (resume/LinkedIn/README generation)

### Webhooks
- `POST /api/webhooks/github`

### Meta
- `GET /` – Service info · `GET /health` · `GET /health/detailed` (checks DB + Redis)

**Interactive docs:** http://localhost:8000/docs (Swagger UI) once the API is running.

## Testing

```bash
cd RepoSense-master

# Root-level basic tests
pytest tests/ -v

# Validate all backend imports resolve (useful after dependency changes)
python services/api/test_imports.py
```

There is currently no dedicated `test_api.py` / `test_ml.py` / `test_performance.py` suite in this repo — only `tests/test_basic.py` and `services/api/test_imports.py`. If you're adding test coverage, that's the gap to fill.

## Deployment

### Local Development
```bash
make dev      # docker-compose up + frontend dev server + API with --reload
make build    # Build all Docker images
make test     # Run backend + frontend tests
```

`make migrate` currently only runs migrations 001–004 — it predates migrations 005–012. Use `python services/api/run_migrations.py` instead, which runs all 12.

### Docker Compose
```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### Manual / Cloud Deployment
See [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md). There is no committed `railway.json` or Terraform config in this repo despite what earlier docs implied — the Makefile's `deploy` target references `infrastructure/terraform` and `scripts/deploy.sh`, neither of which exist yet. Treat AWS/Railway deployment as a manual process using the Deployment Guide until that tooling is added.

## Documentation

| Document | Purpose |
|---|---|
| [README.md](./README.md) | This file |
| [apps/OVERVIEW.md](./apps/OVERVIEW.md) | Executive summary & architecture |
| [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md) | Full setup + database schema (all 12 migrations) |
| [docs/DEPLOYMENT_GUIDE.md](./docs/DEPLOYMENT_GUIDE.md) | Production deployment |
| [docs/SETUP_COMPLETE.md](./docs/SETUP_COMPLETE.md) | Model quick-start |
| [docs/MODEL_CONFIGURATION.md](./docs/MODEL_CONFIGURATION.md) | ML environment variable reference |
| [docs/COMPLETE_MODEL_MIGRATION_GUIDE.md](./docs/COMPLETE_MODEL_MIGRATION_GUIDE.md) | Historical: HF Hub model migration |
| [apps/web/README.md](./apps/web/README.md) | Frontend docs |
| [services/README.md](./services/README.md) | Backend microservices guide |
| [services/api/README.md](./services/api/README.md) | Core API documentation |
| [services/api/crawler/README.md](./services/api/crawler/README.md) | Job crawler guide |
| [services/api/neural_generator/README.md](./services/api/neural_generator/README.md) | LLM generator guide |
| [services/api/rag/README.md](./services/api/rag/README.md) | RAG service documentation |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

- Follow PEP 8 for Python code
- Use TypeScript strict mode for frontend
- Write tests for new features (see the Testing section above — coverage is currently thin)
- Update documentation in the relevant README when behavior changes


## Support

- **Issues / Discussions:** GitHub
- **Documentation:** `/docs` folder and the service-level READMEs linked above
- **Setup help:** [docs/SETUP_GUIDE.md](./docs/SETUP_GUIDE.md)








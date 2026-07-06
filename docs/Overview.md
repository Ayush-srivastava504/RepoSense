# RepoSense — Executive Summary & Architecture

> A full-stack platform combining job aggregation, AI resume/LinkedIn tooling, and automated code review, built on a Next.js frontend and four independent Python microservices.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Services](#services)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running Tests](#running-tests)
- [Database Migrations](#database-migrations)
- [Deployment](#deployment)
- [Environment Variables](#environment-variables)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)

---

## Overview

RepoSense is a monorepo that combines four backend microservices — the **Core API**, a **Job Crawler**, a **RAG (Retrieval-Augmented Generation)** service, and a **Neural Generator** — with a **Next.js** frontend. Together they power:

1. Multi-source job aggregation with company-trust ranking (9+ scrapers).
2. AI resume building, LinkedIn profile optimization, and code review/auto-fix, all backed by a locally-hosted quantized LLM.
3. Retrieval-augmented, context-grounded README generation for connected GitHub repos.
4. Razorpay-based subscriptions gating premium features (LinkedIn optimizer, code review limits).

All three microservices live *inside* `services/api/` (crawler, rag, neural_generator) — they are not siblings of the API, they are subdirectories of it, each with their own `Dockerfile` and `requirements.txt`.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  Next.js Frontend (:3000)                │
│   Jobs · Resume Builder · LinkedIn Optimizer · GitHub    │
│   Browser + WebSocket Terminal · Razorpay Checkout       │
└───────────────────────┬────────────────────────────────────┘
                        │ REST / WebSocket
┌───────────────────────▼────────────────────────────────────┐
│           Core API — FastAPI app (services/api/src)        │
│  routes: auth · github · jobs · resume · linkedin ·         │
│          subscription · webhooks · async-jobs                │
│  api:    /api/v1/review, /api/v1/fix, /api/v1/self-healing   │
└──────┬─────────────────────┬────────────────────┬──────────┘
       │                     │                    │
┌──────▼──────┐     ┌────────▼────────┐   ┌───────▼────────┐
│  PostgreSQL │     │  RAG (:8001)    │   │ Neural Gen     │
│  + Redis    │     │  FAISS +        │◄──┤ (:8002)        │
│             │     │  sentence-      │   │ Qwen3-0.6B GGUF│
│             │     │  transformers   │   │ llama-cpp-python│
└─────────────┘     └─────────────────┘   └────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Crawler (services/api/crawler) — batch job, not a        │
│  request-time dependency of the API. Run on a schedule    │
│  (cron / CI / manually) to refresh the jobs table.         │
│  9+ scrapers: LinkedIn, Indeed, Naukri, Internshala,       │
│  Wellfound, Unstop, Glassdoor, Cutshort, company portals   │
└──────────────────────────────────────────────────────────┘
```

Code review (CodeBERT analysis, auto-fix, self-healing) runs **inside the Core API process** — `analysis_engine.py`, `auto_fixer.py`, and `validation_engine.py` are services within `services/api/src/services/`, not a separate microservice. Only the crawler, RAG, and neural generator are split out as separate FastAPI apps.

---

## Services

### 1. Core API (`services/api/src`)
The main FastAPI application. Owns auth (email OTP + guest sessions + optional GitHub OAuth), jobs, resumes, the LinkedIn optimizer, subscriptions, webhooks, async job polling, and code review/self-healing.

- **Entry point:** `services/api/src/core/app.py` (`create_application()`)
- **Run with:** `uvicorn src.app:app --port 8000` from `services/api/`

### 2. Crawler (`services/api/crawler`)
Scrapes 9+ job boards using Playwright + httpx/BeautifulSoup, normalizes and deduplicates results, and writes directly to PostgreSQL. It is a CLI batch job (`python src/index.py --scrapers ... --max-pages ...`), not a persistent HTTP server.

- **Entry point:** `services/api/crawler/src/index.py`
- **Scrapers:** `services/api/crawler/src/scrapers/`
- **Processors:** `services/api/crawler/src/processors/` (`dedupe.py`, `enricher.py`, `normalizer.py`, `trust.py`)

### 3. RAG — Retrieval-Augmented Generation (`services/api/rag`)
Indexes repository code as vector embeddings (`sentence-transformers` + FAISS) and generates context-grounded READMEs by retrieving relevant chunks and passing them to the Neural Generator.

- **Entry point:** `services/api/rag/src/app.py`
- **Key modules:** `chunker.py`, `embedder.py`, `vector_store.py`, `generator.py`
- **Endpoints:** `POST /api/rag/index`, `POST /api/rag/generate`, `GET /health`

### 4. Neural Generator (`services/api/neural_generator`)
Runs a local, quantized **Qwen3-0.6B** GGUF model via `llama-cpp-python` — CPU-only, no GPU or cloud API required. Used for README generation (via RAG), resume content generation, and LinkedIn suggestion generation.

- **Entry point:** `services/api/neural_generator/src/app.py`
- **Endpoints:** `POST /generate`, `GET /health`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, react-three-fiber, xterm.js |
| Backend | FastAPI, Python 3.11+ |
| Code Analysis | HuggingFace Transformers, CodeBERT (`microsoft/codebert-base`) |
| LLM Inference | llama-cpp-python, Qwen3-0.6B-Q4_K_M GGUF (quantized, CPU-only) |
| Semantic Search | sentence-transformers, FAISS |
| Crawling | Playwright, httpx, BeautifulSoup |
| Database | PostgreSQL 15 |
| Cache | Redis |
| Auth | Email OTP (Resend) + guest JWT sessions + optional GitHub OAuth (Fernet-encrypted tokens) — no passwords |
| Payments | Razorpay |
| Infrastructure | Docker, Docker Compose (Railway/Terraform config referenced by the Makefile does not currently exist in-repo) |
| Testing | Pytest |

---

## Project Structure

```
RepoSense-master/
├── apps/
│   ├── OVERVIEW.md
│   └── web/                          # Next.js frontend
│       ├── app/                      # App Router pages & layouts
│       ├── app/components/           # React components
│       └── lib/                      # api.ts, auth.ts (OTP+guest), jobs.ts, stripe.ts (→ Razorpay)
├── services/
│   ├── app.py                        # Convenience launcher for services/api
│   └── api/
│       ├── src/                      # Core FastAPI app (routes, services, configs)
│       ├── database/migrations/      # 001–012, run via run_migrations.py
│       ├── crawler/                  # Job scraper microservice
│       ├── rag/                      # RAG microservice
│       └── neural_generator/         # LLM inference microservice
├── infrastructure/docker/
│   └── docker-compose.yml
├── docs/                             # Setup, deployment, and model config guides
├── tests/                            # Root-level pytest suite (currently minimal)
└── Makefile
```

There is no root-level `railway.json`, `package.json` workspace file, or `database/` directory at the repo root — migrations live under `services/api/database/migrations/`.

---

## Getting Started

### Prerequisites

- Python 3.11+
- Node.js 18+
- PostgreSQL 15 (or use Docker Compose)
- Docker & Docker Compose (recommended, especially for RAG/Neural Generator which use prebuilt model images)

### 1. Clone the repository

```bash
git clone <repo-url>
cd RepoSense-master
```

### 2. Set up environment variables

There is no committed `.env.example` at the repo root. Create `services/api/.env` (or a root `.env` — `config.py` resolves it four levels up from `services/api/src/configs/`) with at minimum: `DATABASE_URL`, `JWT_SECRET`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RESEND_API_KEY`, `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_TOKEN_ENCRYPTION_KEY`. See [docs/MODEL_CONFIGURATION.md](../docs/MODEL_CONFIGURATION.md) for the ML-specific variables.

### 3. Install dependencies

```bash
# Core API
pip install -r services/api/requirements.txt

# Crawler / RAG / Neural Generator each have their own requirements.txt
pip install -r services/api/crawler/requirements.txt
pip install -r services/api/rag/requirements.txt
pip install -r services/api/neural_generator/requirements.txt

# Frontend
cd apps/web && npm install
```

### 4. Run the full stack with Docker Compose

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

### 5. Run the frontend in dev mode

```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

### 6. Run a backend service individually

```bash
cd services/api/rag
uvicorn src.app:app --reload --port 8001
```

---

## Running Tests

```bash
# From the project root
pytest tests/ -v

# Validate that all backend imports resolve
python services/api/test_imports.py
```

The repo currently ships only `tests/test_basic.py` at the root plus `services/api/test_imports.py`. Earlier docs referenced `test_api.py`, `test_ml.py`, `test_analysis.py`, `test_self_healing_pipeline.py`, `test_performance.py`, and `validate_system.py` — **none of these exist in the current codebase.** If you need that coverage, it needs to be written.

---

## Database Migrations

Migrations live in `services/api/database/migrations/` (not a root-level `database/` folder):

| Migration | Creates / Does |
|---|---|
| `001_users.sql` | `users` table |
| `002_resumes.sql` | `resumes` table |
| `003_jobs.sql` | `jobs` table |
| `004_subscriptions.sql` | `subscriptions` table |
| `005_repo_docs.sql` | `repo_docs` table (RAG service) |
| `006_subscriptions_unique_constraint.sql` | Adds a unique constraint to `subscriptions` |
| `007_migrate_stripe_to_razorpay.sql` | Migrates payment provider from Stripe to Razorpay |
| `008_otp_auth.sql` | Adds email OTP auth support |
| `009_async_jobs.sql` | Adds the async job queue table |
| `010_linkedin_optimizer.sql` | Adds LinkedIn optimizer tables |
| `011_job_trust_and_ranking.sql` | Adds job trust/ranking columns |
| `012_guest_users.sql` | Adds guest user support |

Run all migrations:

```bash
python services/api/run_migrations.py
```

`make migrate` in the root Makefile is stale — it only runs migrations 001–004.

---

## Deployment

There is currently no committed Railway or Terraform configuration in this repo, despite the Makefile's `deploy` target referencing `infrastructure/terraform` and `scripts/deploy.sh`. The supported path today is Docker Compose:

```bash
docker-compose -f infrastructure/docker/docker-compose.yml up -d
```

See [docs/DEPLOYMENT_GUIDE.md](../docs/DEPLOYMENT_GUIDE.md) for details and options for cloud deployment without the missing tooling.

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string (default `redis://redis:6379`) |
| `JWT_SECRET` | Signing secret for auth JWTs |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | GitHub OAuth app credentials |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Fernet key used to encrypt stored GitHub tokens |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay API credentials (**not** Stripe) |
| `RESEND_API_KEY` / `EMAIL_PROVIDER` | Email OTP delivery |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` | Resume storage |
| `RAG_SERVICE_URL` / `NEURAL_GENERATOR_URL` | Internal service URLs |
| `CORS_ORIGINS` | JSON array of allowed frontend origins |
| `REQUIRE_AUTH` | If `true`, disables guest sessions and requires OTP login everywhere |
| `MODEL_PATH`, `LLM_N_THREADS`, `LLM_N_CTX`, `LLM_N_GPU_LAYERS` | Neural Generator GGUF model config |
| `CODEBERT_MODEL`, `MODEL_CACHE_DIR` | Code-analysis model config |

See [docs/MODEL_CONFIGURATION.md](../docs/MODEL_CONFIGURATION.md) for the full ML-related reference.

---

## API Endpoints

| Method | Path | Service | Description |
|---|---|---|---|
| `GET` | `/health`, `/health/detailed` | Core API | Health check (DB + Redis) |
| `POST` | `/api/auth/otp/request`, `/api/auth/otp/verify` | Core API | Email OTP login |
| `POST` | `/api/auth/guest` | Core API | Anonymous session |
| `GET` | `/api/jobs/` | Core API | Search jobs |
| `POST` | `/api/resume/generate` | Core API | AI resume generation |
| `POST` | `/api/linkedin/analyze` | Core API | LinkedIn profile analysis (async) |
| `POST` | `/api/v1/review`, `/api/v1/fix` | Core API | Code review & auto-fix |
| `POST` | `/api/v1/self-healing/fix-and-validate` | Core API | Combined fix + validate |
| `POST` | `/api/subscription/create-checkout` | Core API | Razorpay checkout |
| `POST` | `/api/rag/index`, `/api/rag/generate` | RAG | Index code, generate README |
| `POST` | `/generate` | Neural Generator | Raw LLM text generation |

Full endpoint list: [../README.md](../README.md#core-api-endpoints).

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request.

Run `pytest tests/ -v` and `npm run lint` (in `apps/web`) before submitting.

---

> Built with FastAPI, Next.js, and a local quantized LLM — no third-party AI APIs required for core inference.
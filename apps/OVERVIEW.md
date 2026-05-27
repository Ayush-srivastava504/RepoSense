# Repo_Sense

> An intelligent job-matching platform that crawls job boards, indexes repository documentation, and generates tailored resume insights using local LLMs and retrieval-augmented generation.

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

Repo_Sense is a full-stack monorepo that combines three backend microservices — a **Job Crawler**, a **RAG (Retrieval-Augmented Generation)** service, and a **Neural Generator** — with a **Next.js** frontend. Together, they power a pipeline that:

1. Scrapes job listings from boards like LinkedIn and Indeed.
2. Stores and indexes job data alongside user resumes and repository documentation.
3. Uses local LLMs with vector-search retrieval to generate context-aware insights, recommendations, and auto-fixes.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Next.js Frontend                    │
│              (Auth, Dashboard, Resume UI)               │
└───────────────────────┬─────────────────────────────────┘
                        │ REST / HTTP
┌───────────────────────▼─────────────────────────────────┐
│                FastAPI Gateway (src/app.py)              │
│          Routes: /crawler  /rag  /neural-generator      │
└──────┬────────────────┬───────────────────┬─────────────┘
       │                │                   │
┌──────▼──────┐  ┌──────▼──────┐  ┌────────▼────────┐
│   Crawler   │  │     RAG     │  │ Neural Generator │
│  (FastAPI)  │  │  (FastAPI)  │  │   (FastAPI)      │
│             │  │             │  │                  │
│ LinkedIn    │  │ Embeddings  │  │ Local LLM        │
│ Indeed      │  │ FAISS Index │  │ /generate        │
│ Playwright  │  │ Chunker     │  │ /health          │
└──────┬──────┘  └──────┬──────┘  └────────┬─────────┘
       │                │                   │
       └────────────────▼───────────────────┘
                        │
              ┌─────────▼─────────┐
              │   PostgreSQL DB   │
              │ users / resumes   │
              │ jobs / repo_docs  │
              │ subscriptions     │
              └───────────────────┘
```

---

## Services

### 1. Crawler
Scrapes job listings from LinkedIn, Indeed, and other boards using Playwright and Selenium. Cleaned data is stored in DynamoDB and/or the relational database.

- **Entry point:** `services/crawler/src/index.py`
- **Scrapers:** `services/crawler/src/scrapers/`
- **Processors:** `services/crawler/src/processors/`

### 2. RAG (Retrieval-Augmented Generation)
Indexes repository documentation and resumes as vector embeddings (via `sentence-transformers` + FAISS). Serves semantic search and context retrieval for the neural generator.

- **Entry point:** `services/rag/src/app.py`
- **Key modules:** `embedder.py`, `vector_store.py`, `chunker.py`, `generator.py`
- **Endpoints:** `GET /health`, `GET /docs`

### 3. Neural Generator
Runs a local LLM (via HuggingFace `transformers` + `torch`) to generate resume insights, job-match summaries, and code auto-fixes based on RAG-retrieved context.

- **Entry point:** `services/neural-generator/src/app.py`
- **Endpoints:** `POST /generate`, `GET /health`

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS |
| Backend | FastAPI, Python 3.10+ |
| ML / NLP | HuggingFace Transformers, sentence-transformers, FAISS, PyTorch |
| Crawling | Playwright, Selenium |
| Database | PostgreSQL |
| Auth | Custom auth (`lib/auth.ts`) |
| Payments | Razorpay (`lib/razorpay.ts`) |
| Infrastructure | Docker, Docker Compose, Railway.app |
| Testing | Pytest |

---

## Project Structure

```
Repo_Sense/
├── apps/
│   └── web/                  # Next.js frontend
│       ├── app/              # App Router pages & layouts
│       ├── components/       # React components
│       └── lib/              # api.ts, auth.ts, razorpay.ts
├── services/
│   ├── crawler/              # Job board scraping service
│   ├── rag/                  # RAG service (embeddings + retrieval)
│   └── neural-generator/     # Local LLM generation service
├── database/
│   └── migrations/           # SQL migration scripts (001–005)
├── tests/                    # Pytest test suite
├── infrastructure/
│   ├── docker-compose.yml
│   └── docker-compose.prod.yml
├── run_migrations.py
├── Makefile
├── railway.json
└── .env
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL (or use the Docker Compose setup)

### 1. Clone the repository

```bash
git clone https://github.com/your-org/Repo_Sense.git
cd Repo_Sense
```

### 2. Set up environment variables

```bash
cp .env.example .env
# Fill in your values (DB URL, AWS keys, model paths, Stripe keys, etc.)
```

### 3. Install dependencies

```bash
# Python (backend services)
pip install -r services/api/requirements.txt

# Node (frontend)
cd apps/web && npm install
```

Or use the Makefile shortcut:

```bash
make install
```

### 4. Run the full stack with Docker Compose

```bash
docker-compose up -d
```

### 5. Run the frontend in dev mode

```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

### 6. Run a backend service individually

```bash
cd services/rag
uvicorn src.app:app --reload --port 8001
```

---

## Running Tests

```bash
# From the project root
pytest -v

# Or target a specific test file
pytest tests/test_api.py -v
```

Key test files:

| File | Covers |
|---|---|
| `test_api.py` | FastAPI endpoint integration tests |
| `test_ml.py` | Model loading and inference |
| `test_analysis.py` | ML analysis engine unit tests |
| `test_self_healing_pipeline.py` | End-to-end self-healing pipeline |
| `test_performance.py` | Latency and throughput benchmarks |
| `validate_system.py` | Full system validation suite |

---

## Database Migrations

Migrations live in `database/migrations/` and are numbered sequentially:

| Migration | Table Created |
|---|---|
| `001_users.sql` | `users` |
| `002_resumes.sql` | `resumes` |
| `003_jobs.sql` | `jobs` |
| `004_subscriptions.sql` | `subscriptions` |
| `005_repo_docs.sql` | `repo_docs` (RAG service) |

Run all migrations:

```bash
python run_migrations.py
```

---

## Deployment

Repo_Sense is configured for deployment on [Railway.app](https://railway.app) via `railway.json`.

```bash
# Production Docker Compose
docker-compose -f infrastructure/docker-compose.prod.yml up -d

# Or use the Makefile
make docker-build
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `AWS_ACCESS_KEY_ID` | AWS key for S3 / DynamoDB |
| `AWS_SECRET_ACCESS_KEY` | AWS secret |
| `MODEL_PATH` | Path to local LLM model files |
| `STRIPE_SECRET_KEY` | Stripe API key |
| `NEXT_PUBLIC_API_URL` | Backend API base URL (for the frontend) |

See `.env.example` for the full list.

---

## API Endpoints

| Method | Path | Service | Description |
|---|---|---|---|
| `GET` | `/health` | RAG / Neural | Health check |
| `POST` | `/generate` | Neural Generator | Generate LLM output |
| `GET` | `/docs` | RAG | Swagger UI |
| `GET` | `/crawler/jobs` | Crawler | Fetch scraped jobs |

---

## Contributing

1. Fork the repository.
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "feat: add your feature"`
4. Push and open a Pull Request.

Please run `pytest` and the linter (`npm run lint` in `apps/web`) before submitting.

---

> Built with FastAPI, Next.js, and local LLMs — no third-party AI APIs required for core inference.
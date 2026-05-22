# RepoSense – AI‑Powered Code Review System

## Overview
RepoSense is a full‑stack, production‑grade system that provides **instant, AI‑driven code reviews**. It analyses source files, detects bugs, quality issues, and readability problems, and returns structured feedback with confidence scores. The repository includes:

- **Backend services** (FastAPI) for crawling job data, a Retrieval‑Augmented Generation (RAG) documentation API, and a local LLM text‑generation service.
- **Frontend** (Next.js) UI for interacting with the review API.
- **Database migrations**, Docker‑Compose infrastructure, and a comprehensive test suite.

## Key Features
- Multi‑language code analysis (Python, TypeScript, etc.)
- Real‑time feedback (< 1 s for 500‑line files)
- Confidence scoring and actionable suggestions
- Batch processing for up to 50 files per request
- Docker‑ready, easy to deploy on any cloud platform
- Extensible detection rules and language support

## Quick Start
```bash
# Clone the repo
git clone <repo-url>
cd RepoSense

# Backend setup (Python)
cd services
python -m venv venv
source venv/bin/activate   # on Windows: venv\Scripts\activate
pip install -r requirements.txt

# Run the API (example: review service)
uvicorn src.app:app --reload

# Frontend setup (Node.js)
cd ../apps/web
npm install
npm run dev   # http://localhost:3000
```

## Directory Structure & File Purpose
```
RepoSense/
├─ **README.md**                – High‑level project description (this file).
├─ **SETUP_GUIDE.md**          – Detailed step‑by‑step setup instructions.
├─ **Makefile**                 – Shortcut commands (install, test, docker‑build).
├─ **package.json**             – Node package manifest for the monorepo.
├─ **railway.json**             – Railway deployment config.
├─ **.env**, **.env.example**   – Environment variable templates for services.
├─ **run_migrations.py**        – Executes SQL migrations.
├─ **infrastructure/**
│   └─ docker-compose.yml       – Docker Compose for local dev.
│   └─ docker-compose.prod.yml  – Production Compose.
├─ **database/**
│   └─ migrations/               – SQL files that create DB tables.
├─ **apps/web/**                – Next.js frontend.
│   ├─ **README.md**            – Frontend README (dev server, deploy).
│   ├─ **package.json**         – Frontend dependencies.
│   ├─ **next.config.js**      – Next.js config.
│   ├─ **tailwind.config.js**  – Tailwind CSS config.
│   ├─ **tsconfig.json**       – TypeScript config.
│   └─ **app/**                – App Router pages, layouts, auth routes.
│       ├─ **layout.tsx**       – Global layout component.
│       ├─ **page.tsx**         – Home page.
│       └─ **(auth)/**          – Auth‑related pages (login, register, dashboard).
│           └─ **...**
│   └─ **components/**          – Re‑usable React components (e.g., Terminal).
│   └─ **lib/**                 – Helper modules for API calls, auth, Stripe.
│   └─ **public/**              – Static assets.
├─ **services/**                – Backend FastAPI services.
│   ├─ **requirements.txt**    – Python dependencies.
│   ├─ **Dockerfile**           – Container image for services.
│   ├─ **.env**, **.env.example** – Service env vars.
│   ├─ **src/**
│   │   ├─ **app.py**           – FastAPI app factory, mounts routers.
│   │   ├─ **config.py**        – Pydantic settings (loads env vars).
│   │   ├─ **routes.py**        – Top‑level router includes sub‑services.
│   │   ├─ **models/**          – Pydantic schemas for request/response.
│   │   └─ **services/**
│   │       ├─ **crawler/**
│   │       │   ├─ **README.md**            – Crawler overview, usage.
│   │       │   ├─ **src/**                – Scrapers, processors, utils.
│   │       │   ├─ **requirements.txt**    – Crawler‑specific deps.
│   │       │   └─ **Dockerfile**          – Crawler container.
│   │       ├─ **rag/**
│   │       │   ├─ **README.md**            – RAG service docs.
│   │       │   ├─ **src/**                – FastAPI app, config, services (generator, vector_store, embedder, chunker).
│   │       │   ├─ **requirements.txt**    – RAG deps (sentence‑transformers, faiss).
│   │       │   └─ **Dockerfile**          – RAG container.
│   │       └─ **neural-generator/**
│   │           ├─ **README.md**            – Local LLM generator docs.
│   │           ├─ **src/**                – FastAPI app, config, models.
│   │           ├─ **requirements.txt**    – Generator deps (transformers, torch).
│   │           └─ **Dockerfile**          – Generator container.
├─ **tests/**
│   ├─ **test_api.py**          – Integration tests for FastAPI endpoints.
│   ├─ **test_analysis.py**     – Unit tests for ML analysis engine.
│   ├─ **test_ml.py**           – Model loading & inference tests.
│   ├─ **test_performance.py** – Benchmark tests (latency, throughput).
│   ├─ **test_self_healing.py** – End‑to‑end self‑healing pipeline tests.
│   └─ … (other test files covering validation, autofix, etc.)
├─ **logs/**                    – Runtime log files (rotated).
├─ **.model_cache/**            – Cached ML model files.
├─ **venv/**                    – Python virtual environment.
└─ **node_modules/**            – Node.js dependencies for the frontend.
```

## Running the Full Stack with Docker
```bash
# From the repository root
docker-compose up -d   # starts API services, DB, and web UI
```

## Testing
```bash
pytest -v               # run all tests
pytest tests/test_api.py   # run a specific test file
```

## License
MIT License – see the LICENSE file.

---
*For any additional details, refer to the individual `README.md` files inside each service directory or the `SETUP_GUIDE.md` for end‑to‑end deployment instructions.*

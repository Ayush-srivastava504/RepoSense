# services/

Backend services for RepoSense. Everything here is Python (FastAPI-based
microservices plus a scraper), orchestrated together by
`infrastructure/docker/docker-compose.yml`.

## Contents

| Path                    | What it is |
|--------------------------|------------|
| `api/`                    | The core FastAPI backend — auth, jobs, resumes, ATS, code review, dashboard, subscriptions, etc. See `api/README.md`. |
| `api/rag/`                 | Retrieval-augmented documentation/Q&A microservice. See `api/rag/README.md`. |
| `api/neural_generator/`    | Local LLM (llama.cpp) text-generation microservice used by AI features. See `api/neural_generator/README.md`. |
| `api/crawler/`             | Scheduled job/hackathon scraper covering dozens of external boards. See `api/crawler/README.md`. |
| `api/loadtest/`            | k6 load-testing scripts for the core API. See `api/loadtest/README.md`. |
| `api/database/migrations/` | Ordered SQL migrations applied to the Postgres schema. |
| `app.py`                   | Convenience entrypoint used by tooling that expects a top-level `app` module. |

## Running locally

Each service has its own `requirements.txt` and `Dockerfile`. For local
development without Docker:

```bash
cd services/api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8000
```

For the full stack (Postgres, Redis, and all microservices), use the
docker-compose stack described in the root `README.md`.

## Database

Migrations live in `api/database/migrations/`, numbered sequentially
(`001_users.sql` ... `018_logo_domain.sql`). Apply them in order against
`DATABASE_URL` — `make migrate` from the repo root runs the first four;
`services/api/run_migrations.py` runs the full set programmatically.

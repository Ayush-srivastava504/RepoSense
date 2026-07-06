# RepoSense Core API

> FastAPI service that is the central backend for RepoSense: email-OTP + guest authentication, GitHub integration, AI code review/self-healing, job search, resume generation, the LinkedIn Profile Optimizer, and Razorpay subscriptions.

## Overview

The Core API (`services/api/src`) does the following:
- **Authenticates users** via email OTP (Resend) or anonymous guest JWT sessions — there is no password-based login and GitHub is *not* the primary sign-in method (it's an optional account connection for the repo browser/terminal features)
- **Orchestrates AI code review** — CodeBERT static analysis, LLM-based auto-fix, and a combined "self-healing" fix-and-validate endpoint, all running in-process (no separate review microservice)
- **Calls out to two sibling microservices** — RAG (`RAG_SERVICE_URL`) for README generation, Neural Generator (`NEURAL_GENERATOR_URL`) for LLM text generation used by resume and LinkedIn features
- **Handles Razorpay payments** — checkout creation, HMAC-verified webhooks, subscription status
- **Runs long jobs asynchronously** — resume generation, LinkedIn analysis, and README generation are queued and polled via `/api/async-jobs/{id}`, since local LLM inference can take 30–90s+
- **Rate-limits and logs every request** via middleware

## Tech Stack

| Component | Technology |
|---|---|
| Framework | FastAPI |
| Validation | Pydantic v2 (+ `pydantic-settings`) |
| Database | PostgreSQL, `asyncpg` |
| Cache | Redis (optional — app degrades gracefully without it) |
| Auth | JWT (`python-jose`) + email OTP + optional GitHub OAuth |
| Encryption | Fernet (`cryptography`) for stored GitHub tokens |
| Payments | `razorpay` Python SDK |
| Code analysis | HuggingFace Transformers, CodeBERT (`microsoft/codebert-base`) |
| Async | `asyncio`, `httpx` |

## Quick Start

```bash
cd services/api
python -m venv venv
source venv/bin/activate      # Linux/Mac
pip install -r requirements.txt

# Create a .env — config.py looks for it 4 directories up from
# src/configs/, i.e. at the repo root (RepoSense-master/.env)
# See "Configuration" below for the variable list.

python run_migrations.py       # runs all 12 migrations
uvicorn src.app:app --reload --port 8000
```

- **API:** http://localhost:8000
- **Swagger:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

There is no committed `.env.example` in this repo — set the variables below directly.

## Configuration

All settings are defined in `src/configs/config.py` (a Pydantic `Settings` class read from the repo-root `.env`). `src/configs/settings.py` currently defines an identical class — it appears to be leftover duplication; `config.py` is the one actually imported by the app.

```env
# Core
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=your_secret_key_minimum_32_characters
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GITHUB_REDIRECT_URI=http://localhost:8000/api/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=          # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
REQUIRE_AUTH=false                     # true disables guest sessions

# Frontend / CORS
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# Payments — Razorpay, NOT Stripe (migrated in 007_migrate_stripe_to_razorpay.sql)
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=

# Email (OTP delivery)
EMAIL_PROVIDER=resend
RESEND_API_KEY=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
S3_BUCKET=resume-storage

# Sibling microservices
RAG_SERVICE_URL=http://localhost:8001
NEURAL_GENERATOR_URL=http://localhost:8002
```

`CODEBERT_MODEL`, `DEVICE`, `MAX_TOKENS`, `MODEL_CACHE_DIR` (code-analysis model config) live separately in `src/configs/ml_config.py`, prefixed `MODEL_` — e.g. `MODEL_NAME`, `MODEL_CACHE_DIR`.

There is no `DATABASE_POOL_SIZE`, `JWT_EXPIRY_HOURS`, `CACHE_TTL`, `SENTRY_DSN`, or `STRIPE_*` variable read anywhere in the current code, despite appearing in older docs.

## Database Schema

Tables as actually defined across the 12 migrations in `database/migrations/`:

```sql
-- 001: users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,       -- vestigial: OTP auth (008) doesn't use this
    subscription_tier TEXT DEFAULT 'free',
    github_token TEXT,                 -- Fernet-encrypted
    created_at TIMESTAMP DEFAULT NOW()
);
-- + is_guest BOOLEAN (012), OTP columns (008)

-- 002: resumes, 003: jobs, 005: repo_docs — see individual migration files for full columns

-- 004 + 007: subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    stripe_customer_id TEXT,           -- kept for historical data, no longer written to
    stripe_subscription_id TEXT,       -- kept for historical data, no longer written to
    status TEXT DEFAULT 'inactive',
    current_period_end TIMESTAMP,
    razorpay_order_id TEXT UNIQUE,     -- added in 007, this is what's actually used now
    razorpay_payment_id TEXT,
    plan TEXT DEFAULT 'pro'
);

-- 009: async_jobs table (resume/LinkedIn/README generation queue)
-- 010: LinkedIn optimizer tables
-- 011: job trust/ranking columns on jobs
-- 012: is_guest on users
```

There is no `reviews` table — code review results are returned synchronously in the API response and are not persisted. If you need review history, that's a gap to fill, not an existing feature.

## Complete API Endpoint Reference

### Auth (`/api/auth`) — email OTP + guest, no passwords
| Method | Path | Notes |
|---|---|---|
| POST | `/otp/request` | `{ "email": "..." }` → sends 6-digit code via Resend, 10 min TTL |
| POST | `/otp/verify` | `{ "email": "...", "otp": "..." }` → `{ "access_token": "<jwt>" }`, 7-day expiry |
| POST | `/guest` | No body → mints an anonymous JWT; no-ops if already authed or `REQUIRE_AUTH=true` |

### GitHub (`/api/github`) — optional account connection
| Method | Path | Notes |
|---|---|---|
| GET | `/login` | Starts OAuth flow |
| GET | `/callback` | OAuth callback |
| GET | `/exchange` | Code exchange |
| POST | `/disconnect` | Remove stored GitHub token |
| GET | `/repos` | List connected user's repos |
| GET | `/contents` | Browse repo directory |
| GET | `/file` | Fetch a single file's content |
| POST | `/{owner}/{repo}/auto-setup` | Generates a README via the RAG service |
| POST | `/terminal/token` | Short-lived token for the WebSocket in-browser terminal |

### Code Review (`/api/v1`)
| Method | Path | Notes |
|---|---|---|
| POST | `/review` | `{ code, language, focus_areas?, include_metrics? }`, requires auth. Runs CodeBERT analysis with a 200KB payload cap and 10s analysis timeout (guardrails added 2026-06-25 alongside a ReDoS fix) |
| POST | `/fix` | `{ code, language, issues, dry_run? }` — auto-fix using issues from `/review` |
| POST | `/v1/self-healing/fix-and-validate` | Runs auto-fix then validates the result in one call |

### Jobs (`/api/jobs`)
| Method | Path |
|---|---|
| GET | `/` — search/list |
| GET | `/featured` |
| GET | `/{job_id}` |

### Resume (`/api/resume`)
| Method | Path | Notes |
|---|---|---|
| GET | `/test` | Health/smoke endpoint |
| POST | `/generate` | AI resume content generation |
| POST | `/generate-structured` | Structured (section-by-section) generation |
| POST | `/create` | Save a resume |
| GET | `/list` | List a user's resumes |

### LinkedIn Optimizer (`/api/linkedin`) — premium feature
| Method | Path | Notes |
|---|---|---|
| GET | `/status` | Free/ad/pro quota state |
| POST | `/unlock/ad` | Redeem a rewarded-ad credit |
| POST | `/analyze` | Scores a profile against 14 rules, returns `{ job_id }` (async) |
| GET | `/history` | Score-over-time history |

Free users get one lifetime analysis; further analyses require a Pro/Enterprise subscription or watching a rewarded ad.

### Subscriptions (`/api/subscription`) — Razorpay
| Method | Path | Notes |
|---|---|---|
| POST | `/create-checkout` | `plan=pro` (₹999/mo) or `plan=enterprise` (₹2999/mo) |
| POST | `/webhook` | HMAC-signature-verified Razorpay webhook |
| GET | `/status` | Current tier |

### Async Jobs (`/api/async-jobs`)
| Method | Path | Notes |
|---|---|---|
| GET | `/{job_id}` | Poll `status ∈ {pending, running, done, failed}`. Jobs are created inside `resume.py`/`github.py`/`linkedin.py`, not here. |

### Webhooks (`/api/webhooks`)
| Method | Path |
|---|---|
| POST | `/github` |

### Meta
| Method | Path | Notes |
|---|---|---|
| GET | `/` | Service info |
| GET | `/health` | Basic liveness |
| GET | `/health/detailed` | Checks DB + Redis connectivity |

**None of the following exist in the current code**, despite appearing in older docs: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`, `GET /api/review/{id}`, `GET /api/review/history`, `POST /api/subscription/upgrade`, `POST /api/webhook/stripe`, `POST /api/jobs/{id}/apply`, `POST /api/jobs/match`.

## Authentication & Security

JWTs are signed with `JWT_SECRET` (HS256) and carry `sub` (user id), `email`, `subscription_tier`, and a 7-day `exp`. Send them as:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/jobs/featured
```

`middleware/auth.py` exposes a `verify_token` FastAPI dependency used by routes that require auth. Rate limiting is applied globally via `middleware/rate_limit.py`.

## Docker

```bash
cd services/api
docker build -t reposense-api:latest .
```

Or via Compose (recommended — wires up Postgres/Redis/RAG/Neural Generator too):

```bash
docker-compose -f ../../infrastructure/docker/docker-compose.yml up -d
```

The Compose `api` service uses `entrypoint.sh` and depends on `postgres`, `redis`, and `rag` being healthy first.

## Testing

```bash
python test_imports.py     # validates every backend module imports cleanly
cd ../.. && pytest tests/ -v
```

There is no `tests/test_api.py`, `pytest -m integration`, or coverage tooling wired up yet beyond `test_imports.py` and the root `tests/test_basic.py`.

## Monitoring

```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/detailed
```

`monitor.py` in this directory is a standalone script for additional health/metrics checks outside the request path — run it directly with `python monitor.py` rather than expecting it to be wired into the API automatically.

## Deployment

No Railway or systemd unit is currently committed for this service. The supported path today is Docker Compose. See [../../docs/DEPLOYMENT_GUIDE.md](../../docs/DEPLOYMENT_GUIDE.md).

## Related Services

- Frontend: [apps/web/README.md](../../apps/web/README.md)
- Crawler: [services/api/crawler/README.md](./crawler/README.md)
- RAG: [services/api/rag/README.md](./rag/README.md)
- Neural Generator: [services/api/neural_generator/README.md](./neural_generator/README.md)
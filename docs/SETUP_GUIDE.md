# RepoSense - Setup Guide

## 1. DATABASE MIGRATIONS

Migrations live in **`services/api/database/migrations/`** — not a root-level `database/` folder.

### Quick Start (Recommended)

```bash
# Option A: Python migration runner — runs all 12 migrations in order
python services/api/run_migrations.py

# Option B: Manual with psql (all 12, in order)
cd services/api/database/migrations
for f in 001_users.sql 002_resumes.sql 003_jobs.sql 004_subscriptions.sql \
         005_repo_docs.sql 006_subscriptions_unique_constraint.sql \
         007_migrate_stripe_to_razorpay.sql 008_otp_auth.sql \
         009_async_jobs.sql 010_linkedin_optimizer.sql \
         011_job_trust_and_ranking.sql 012_guest_users.sql; do
  psql "$DATABASE_URL" -f "$f"
done
```

`make migrate` in the root Makefile is **stale** — it only runs migrations 001–004 and will leave your schema missing OTP auth, async jobs, LinkedIn optimizer, job trust/ranking, and guest user support. Use `run_migrations.py`.

### What Each Migration Does

| File | Creates / Changes | Purpose |
|---|---|---|
| `001_users.sql` | `users` table | Accounts, subscription tier, (legacy) `github_token` column |
| `002_resumes.sql` | `resumes` table | User-created resumes |
| `003_jobs.sql` | `jobs` table | Scraped job/internship postings |
| `004_subscriptions.sql` | `subscriptions` table | Originally Stripe-shaped payment records |
| `005_repo_docs.sql` | `repo_docs` table | Generated READMEs (RAG service) |
| `006_subscriptions_unique_constraint.sql` | `subscriptions` | Adds a unique constraint |
| `007_migrate_stripe_to_razorpay.sql` | `subscriptions` | Adds `razorpay_order_id`, `razorpay_payment_id`, `plan`; keeps old `stripe_*` columns for historical data but stops writing to them |
| `008_otp_auth.sql` | `users` | Adds email-OTP columns |
| `009_async_jobs.sql` | new `async_jobs` table | Backs `/api/async-jobs/{id}` polling |
| `010_linkedin_optimizer.sql` | new tables | LinkedIn Profile Optimizer feature |
| `011_job_trust_and_ranking.sql` | `jobs` | Trust/ranking columns used by `processors/trust.py` |
| `012_guest_users.sql` | `users` | Adds `is_guest` column |

### Database Schema (core tables)

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,     -- vestigial: current auth is OTP-based, not password-based
    subscription_tier TEXT DEFAULT 'free',
    github_token TEXT,               -- Fernet-encrypted GitHub access token (optional connection)
    created_at TIMESTAMP DEFAULT NOW()
    -- + is_guest BOOLEAN (012), OTP columns (008)
);

-- Resumes
CREATE TABLE resumes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Jobs
CREATE TABLE jobs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    company TEXT NOT NULL,
    description TEXT,
    url TEXT UNIQUE,
    source TEXT,
    posted_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
    -- + trust/ranking columns (011)
);

-- Subscriptions (Razorpay today — see migration 007)
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    stripe_customer_id TEXT,          -- legacy, historical only
    stripe_subscription_id TEXT,      -- legacy, historical only
    status TEXT DEFAULT 'inactive',
    current_period_end TIMESTAMP,
    razorpay_order_id TEXT UNIQUE,
    razorpay_payment_id TEXT,
    plan TEXT DEFAULT 'pro'
);

-- Repo Docs, async_jobs, LinkedIn optimizer tables: see their individual migration files
```

---

## 2. CRAWLER — WHERE JOBS ARE SAVED

### Flow: Job Scraping → Storage

```
Scraper (LinkedIn, HiringCafe, Internshala,
         Unstop, Cutshort, company_portals)
    ↓
Normalizer (processors/normalizer.py)
    ↓
Deduplicator (processors/dedupe.py)
    ↓
Enricher (processors/enricher.py)
    ↓
Trust/ranking (processors/trust.py)
    ↓
PostgreSQL `jobs` table  ← final storage
```

`config.py` defines `S3_BUCKET`/`S3_PREFIX`/`DYNAMODB_TABLE` variables, but confirm against `utils.py` and `index.py` whether your deployment actually writes raw NDJSON to S3 before the DB write, or whether S3/DynamoDB are unused legacy config in your environment — treat those as optional/unconfirmed rather than a guaranteed intermediate step.

**Query to see recently scraped jobs:**
```sql
SELECT id, title, company, source, posted_at
FROM jobs
WHERE is_active = true
ORDER BY posted_at DESC
LIMIT 50;
```

### Crawler Configuration

Located in `services/api/crawler/src/config.py`. Key settings (all overridable via env vars):

```python
MAX_WORKERS = int(os.getenv("MAX_WORKERS", "8"))
REQUEST_TIMEOUT = int(os.getenv("REQUEST_TIMEOUT", "30"))
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))
RETRY_BACKOFF = float(os.getenv("RETRY_BACKOFF", "2.0"))
RATE_LIMIT_DELAY = float(os.getenv("RATE_LIMIT_DELAY", "1.5"))
USE_PROXY = os.getenv("USE_PROXY", "false")
HEADLESS = os.getenv("HEADLESS", "true")
```

### Running the Crawler

```bash
cd services/api/crawler
pip install -r requirements.txt

# Default run (all enabled scrapers)
python src/index.py

# Custom: specific scrapers, comma-separated, plus a page cap
python src/index.py --scrapers linkedin,hiringcafe --max-pages 5

# Dry run (no DB writes)
python src/index.py --dry-run
```

The crawler is a **one-shot CLI job**, not a persistent server — it exits when the run finishes. Schedule it via cron, a CI job, or a container run, not `uvicorn`.

---

## 3. FIXING TERMINAL ERRORS

### Common Errors & Solutions

#### `ConnectionResetError` / DB connection refused
**Cause:** PostgreSQL not running.
```bash
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
```

#### `redis.exceptions.ConnectionError`
**Cause:** Redis unreachable. The app is designed to degrade gracefully — `/health/detailed` will report `redis: disconnected` rather than crashing. If routes are actually failing (not just health reporting), check `configs/redis.py`.

#### `ModuleNotFoundError: No module named '...'`
```bash
cd services/api
pip install -r requirements.txt
```
For the sub-services, each has its **own** `requirements.txt`:
```bash
pip install -r services/api/crawler/requirements.txt
pip install -r services/api/rag/requirements.txt
pip install -r services/api/neural_generator/requirements.txt
```

#### API starts but every AI feature fails
**Cause:** `RAG_SERVICE_URL` / `NEURAL_GENERATOR_URL` point to services that aren't running. Start those two first, or use Docker Compose which sequences health checks for you.

### How to Run Without Errors, Step by Step

**Step 1 — Start dependencies**
```bash
# Easiest: Docker Compose brings up everything except the frontend
docker-compose -f infrastructure/docker/docker-compose.yml up -d

# Manual alternative:
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:15
docker run -d -p 6379:6379 redis:7-alpine
```

**Step 2 — Run migrations**
```bash
python services/api/run_migrations.py
```

**Step 3 — Start the microservices the API depends on**
```bash
cd services/api/neural_generator && uvicorn src.app:app --port 8002 &
cd services/api/rag && uvicorn src.app:app --port 8001 &
```

**Step 4 — Start the Core API**
```bash
cd services/api
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.core.app:app --reload --host 0.0.0.0 --port 8000
```

Note the module path: `src.core.app:app`, not `src.app:app` — the FastAPI factory (`create_application()`) lives in `src/core/app.py`.

**Step 5 — Start the frontend**
```bash
cd apps/web
npm install
npm run dev
```

**Step 6 — Verify**
```bash
curl http://localhost:8000/health
# {"status": "ok"}

curl http://localhost:8000/health/detailed
# {"status": "ok", "services": {"api": "ok", "db": "ok", "redis": "ok"}}

curl http://localhost:8000/api/jobs/featured
# [] or a list of jobs
```

---

## 4. ENVIRONMENT VARIABLES

`config.py` resolves `.env` from the repo root (four directories up from `services/api/src/configs/`). Create it there:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/internship_db

# Redis
REDIS_URL=redis://localhost:6379

# GitHub OAuth (optional account connection, not primary login)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://localhost:8000/api/github/callback
GITHUB_TOKEN_ENCRYPTION_KEY=your_fernet_key   # python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# JWT
JWT_SECRET=your_secret_key_minimum_32_characters

# Email OTP (primary login)
EMAIL_PROVIDER=resend
RESEND_API_KEY=your_resend_api_key

# Storage (resume PDFs)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-east-1
S3_BUCKET=resume-storage

# Razorpay — not Stripe
RAZORPAY_KEY_ID=rzp_test_...
RAZORPAY_KEY_SECRET=...

# Frontend / CORS
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=["http://localhost:3000","http://localhost:8000"]

# Sibling microservices
RAG_SERVICE_URL=http://localhost:8001
NEURAL_GENERATOR_URL=http://localhost:8002

# Core API
HOST=0.0.0.0
PORT=8000
ENVIRONMENT=development
REQUIRE_AUTH=false
```

`AWS_ACCESS_KEY` / `AWS_SECRET_KEY` / `API_HOST` / `API_PORT` (as seen in older docs) are **not** the variable names the code actually reads — it's `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `HOST`, and `PORT`.

---

## Quick Troubleshooting Checklist

- [ ] PostgreSQL running? → `docker ps | grep postgres`
- [ ] Redis running? → `docker ps | grep redis`
- [ ] Migrations completed (all 12)? → `python services/api/run_migrations.py`
- [ ] `.env` exists at the repo root?
- [ ] Core API deps installed? → `pip install -r services/api/requirements.txt`
- [ ] RAG and Neural Generator running, if you need AI features? → ports 8001 and 8002
- [ ] Backend starts? → `uvicorn src.core.app:app --reload` (from `services/api/`)
- [ ] Frontend starts? → `npm run dev` in `apps/web`
- [ ] API responds? → `curl http://localhost:8000/health/detailed`

---

## Support

If you still see errors, share:
1. The exact error message
2. Which step failed
3. Output of `python services/api/run_migrations.py` and `uvicorn src.core.app:app --reload`
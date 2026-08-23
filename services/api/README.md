# services/api — Core API

FastAPI backend for RepoSense: authentication, job/hackathon listings, resume
generation, ATS scoring, AI code review, LinkedIn analysis, a GitHub-connected
terminal, dashboard stats, subscriptions, and a LeetCode practice judge.

## Structure

```
src/
  api/           Extra routers (code review, self-healing) mounted alongside routes/
  core/          App factory (app.py), dependencies, exception handlers
  configs/       Settings, DB pool, Redis client, ML config
  data/leetcode/ Problem bank + the Blind 75 tracker spreadsheet
  middleware/    Auth and rate-limiting middleware
  routes/        One router per domain (see Endpoints below)
  schemas/       Pydantic request/response models
  services/      Business logic: analysis engine, auto-fixer, resume/PDF
                 generation, LinkedIn rules, job queue, GitHub integration, etc.
  utils/         Logger, crypto helpers, ML model downloader
database/migrations/  Ordered SQL schema migrations
templates/            LaTeX resume template
scripts/               One-off maintenance scripts (e.g. content enrichment backfill)
rag/, neural_generator/, crawler/, loadtest/   Sibling services — see their own READMEs
```

## Running locally

```bash
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn src.app:app --reload --port 8000
```

Or via Docker: `docker build -t reposense-api . && docker run -p 8000:8000 reposense-api`.

## Configuration

Settings are loaded from environment variables / a repo-root `.env` file
(`src/configs/settings.py`). Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_SECRET` | Signs auth tokens |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` / `GITHUB_REDIRECT_URI` | GitHub OAuth |
| `GITHUB_TOKEN_ENCRYPTION_KEY` | Encrypts stored GitHub tokens |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Payment/subscription processing |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` / `S3_BUCKET` | Resume/file storage |
| `RAG_SERVICE_URL` / `NEURAL_GENERATOR_URL` | URLs of the sibling AI microservices |
| `EMAIL_PROVIDER` / `RESEND_API_KEY` | Transactional email |
| `CORS_ORIGINS` | Allowed frontend origins (JSON list) |
| `REQUIRE_AUTH` | Toggle auth enforcement (used for local/dev/load-testing) |
| `LOAD_TEST_BYPASS_KEY` | Bypasses rate limiting for load tests |

## Endpoints

All routes are mounted under `/api`.

- **Auth** (`/api/auth`) — OTP request/verify, guest sessions
- **GitHub** (`/api/github`) — OAuth login/callback/exchange, repo listing,
  file/content browsing, auto-setup, terminal token issuance, disconnect
- **Jobs** (`/api/jobs`) — listing, featured, similar jobs, job detail
- **Companies** (`/api/companies`) — company listing, plus
  `/api/companies/{company}/profile` for enriched overview/work-culture content
- **Hackathons** (`/api/hackathons`) — listing, featured, ending-soon, detail
- **Resume** (`/api/resume`) — generation, cover letters, structured
  generation, create/list
- **ATS** (`/api/ats`) — role list, resume-vs-role ATS check
- **LinkedIn** (`/api/linkedin`) — unlock status, ad-unlock, profile analysis,
  history
- **Review** (`/api/v1`) — AI code review (`/review`) and auto-fix (`/fix`)
- **Self-healing** (`/api/v1/self-healing`) — automated fix-and-retry routes
- **Async jobs** (`/api/async-jobs`) — poll long-running job status
- **Dashboard** (`/api/dashboard`) — usage stats, recent reviews/resumes
- **Subscription** (`/api/subscription`) — checkout, webhook, status
- **Webhooks** (`/api/webhooks`) — inbound GitHub webhook
- **LeetCode** (`/api/leetcode`) — problem list/detail, code submission/judge,
  level and company breakdowns, Blind 75 tracker download

## Content enrichment

Three related pieces generate AI (Groq-backed) fallback content for pages
that would otherwise be thin — each falls back to a deterministic template
generator if `GROQ_API_KEY` is unset or a request fails, so runs always
produce usable content:

- `crawler/src/content_enrichment.py` — runs automatically at the end of
  every crawl, enriching newly-scraped thin job listings
- `scripts/enrich_job_content.py` — scheduled catch-up job for job listings
  still missing an overview (`--force-stale` to re-enrich old rows,
  `--no-fallback` to skip instead of using the template)
- `scripts/enrich_all_content.py` — bulk/fallback runner covering **all**
  pages at once: every job (`--target jobs --bulk`), every company
  (`--target companies`, writes to the new `company_profiles` table —
  overview, work-culture summary, review-style snippets, keywords), and
  optionally a fallback SEO blog post per company (`--blog-posts`, written
  under `apps/web/content/blog/` in the same schema as
  `scripts/generate-daily-posts.mjs`)

```bash
python scripts/enrich_all_content.py --target all --bulk --blog-posts
```

## Testing

```bash
pytest tests/ -v          # from the repo root, or
python test_imports.py    # sanity-check that all modules import cleanly
```

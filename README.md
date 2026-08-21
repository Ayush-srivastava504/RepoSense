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
│
├── .dockerignore
│   → Defines files excluded from Docker build contexts.
│
├── .gitignore
│   → Defines local/generated files excluded from Git.
│
├── .github/
│   └── workflows/
│       └── backend-cicd.yml
│           → GitHub Actions CI/CD workflow for backend build and deployment.
│
├── Makefile
│   → Provides shortcuts for development, build, test, migration, and Docker commands.
│
├── README.md
│   → Main project documentation, architecture overview, setup, and API information.
│
├── ci-test.txt
│   → Small CI test artifact used to verify repository/workflow changes.
│
│
├── apps/
│   │
│   ├── OVERVIEW.md
│   │   → Overview of applications contained in the apps workspace.
│   │
│   └── web/
│       │   → Next.js 14 frontend application deployed separately from backend services.
│       │
│       ├── .gitignore
│       │   → Frontend-specific Git ignore rules.
│       │
│       ├── README.md
│       │   → Frontend setup and development documentation.
│       │
│       ├── app/
│       │   │   → Next.js App Router pages, layouts, and page-level components.
│       │   │
│       │   ├── page.tsx
│       │   │   → Main InternFlow landing page.
│       │   │
│       │   ├── layout.tsx
│       │   │   → Global root layout shared across all frontend routes.
│       │   │
│       │   ├── globals.css
│       │   │   → Global styles and Tailwind CSS configuration rules.
│       │   │
│       │   ├── sitemap.ts
│       │   │   → Dynamically generates the search-engine sitemap.
│       │   │
│       │   ├── about/
│       │   │   └── page.tsx
│       │   │       → Public About page describing InternFlow.
│       │   │
│       │   ├── jobs/
│       │   │   ├── page.tsx
│       │   │   │   → Displays searchable and ranked job listings.
│       │   │   │
│       │   │   └── [slug]/
│       │   │       └── page.tsx
│       │   │           → Dynamic job detail page resolved from the job slug.
│       │   │
│       │   ├── internships/
│       │   │   ├── page.tsx
│       │   │   │   → Displays internship-specific listings.
│       │   │   │
│       │   │   └── [slug]/
│       │   │       └── page.tsx
│       │   │           → Dynamic internship detail page.
│       │   │
│       │   ├── (auth)/
│       │   │   │   → Route group containing authentication and protected product pages.
│       │   │   │
│       │   │   ├── login/
│       │   │   │   └── page.tsx
│       │   │   │       → Email OTP login interface.
│       │   │   │
│       │   │   ├── register/
│       │   │   │   └── page.tsx
│       │   │   │       → OTP-based user account registration interface.
│       │   │   │
│       │   │   ├── dashboard/
│       │   │   │   └── page.tsx
│       │   │   │       → Main authenticated user dashboard.
│       │   │   │
│       │   │   ├── github/
│       │   │   │   └── page.tsx
│       │   │   │       → GitHub repository browser and interactive repository terminal.
│       │   │   │
│       │   │   ├── linkedin/
│       │   │   │   └── page.tsx
│       │   │   │       → LinkedIn profile analysis and optimization interface.
│       │   │   │
│       │   │   └── resume/
│       │   │       └── builder/
│       │   │           └── page.tsx
│       │   │               → AI-assisted resume builder interface.
│       │   │
│       │   └── components/
│       │       │   → Shared UI components primarily used by App Router pages.
│       │       │
│       │       ├── AdSlot.tsx
│       │       │   → Generic advertisement placement component.
│       │       │
│       │       ├── AppShell.tsx
│       │       │   → Shared application shell and page structure.
│       │       │
│       │       ├── ApplyButton.tsx
│       │       │   → Handles job application CTA behaviour.
│       │       │
│       │       ├── AuthGuard.tsx
│       │       │   → Protects frontend content requiring authentication.
│       │       │
│       │       ├── FeaturedJobs.tsx
│       │       │   → Displays selected or highly ranked job opportunities.
│       │       │
│       │       ├── Footer.tsx
│       │       │   → Shared site footer.
│       │       │
│       │       ├── HeroGraph.tsx
│       │       │   → Visual graph used in the landing-page hero section.
│       │       │
│       │       ├── InternshipDetailAds.tsx
│       │       │   → Advertisement placement specifically for internship detail pages.
│       │       │
│       │       ├── JobBadges.tsx
│       │       │   → Renders job metadata and classification badges.
│       │       │
│       │       ├── JobCard.tsx
│       │       │   → Displays an individual job or internship listing card.
│       │       │
│       │       ├── JobDetail.tsx
│       │       │   → Shared detailed job information presentation component.
│       │       │
│       │       ├── Logo.tsx
│       │       │   → InternFlow/RepoSense logo component.
│       │       │
│       │       └── SponsoredCard.tsx
│       │           → Displays sponsored content inside listing feeds.
│       │
│       ├── components/
│       │   └── github/
│       │       └── Terminal.tsx
│       │           → xterm.js-powered live GitHub repository terminal component.
│       │
│       ├── lib/
│       │   │   → Frontend utility, API, authentication, and feature helper modules.
│       │   │
│       │   ├── analytics.ts
│       │   │   → Sends custom frontend events to Google Analytics.
│       │   │
│       │   ├── api.ts
│       │   │   → Central HTTP fetch wrapper for FastAPI backend requests.
│       │   │
│       │   ├── auth.ts
│       │   │   → Handles OTP authentication, JWT storage, and guest sessions.
│       │   │
│       │   ├── featureFlags.ts
│       │   │   → Controls frontend feature availability through flags.
│       │   │
│       │   ├── jobs.ts
│       │   │   → Job and internship API fetching helpers.
│       │   │
│       │   ├── slug.ts
│       │   │   → Creates and processes SEO-friendly job URL slugs.
│       │   │
│       │   ├── stripe.ts
│       │   │   → Legacy-named module containing Razorpay checkout logic.
│       │   │
│       │   └── useAuthGate.ts
│       │       → React authentication gate hook for protected feature access.
│       │
│       ├── public/
│       │   │   → Static assets served directly by Next.js.
│       │   │
│       │   ├── ads.txt
│       │   │   → Declares authorized advertising sellers.
│       │   │
│       │   ├── favicon.ico
│       │   │   → Browser favicon.
│       │   │
│       │   ├── file.svg
│       │   │   → Static file icon asset.
│       │   │
│       │   ├── globe.svg
│       │   │   → Static globe icon asset.
│       │   │
│       │   ├── next.svg
│       │   │   → Next.js logo asset.
│       │   │
│       │   ├── robots.txt
│       │   │   → Search crawler access rules.
│       │   │
│       │   ├── sw.js
│       │   │   → Browser service worker.
│       │   │
│       │   └── window.svg
│       │       → Static browser/window icon asset.
│       │
│       ├── eslint.config.mjs
│       │   → ESLint rules for TypeScript and Next.js source code.
│       │
│       ├── next.config.js
│       │   → Next.js framework and build configuration.
│       │
│       ├── package.json
│       │   → Frontend scripts and JavaScript dependencies.
│       │
│       ├── postcss.config.js
│       │   → PostCSS configuration used by the frontend build.
│       │
│       ├── postcss.config.mjs
│       │   → Alternate ES module PostCSS configuration.
│       │
│       ├── tailwind.config.js
│       │   → Tailwind CSS theme and source scanning configuration.
│       │
│       └── tsconfig.json
│           → TypeScript compiler configuration.
│
│
├── docs/
│   │   → Project setup, deployment, refactoring, and model configuration documentation.
│   │
│   ├── COMPLETE_MODEL_MIGRATION_GUIDE.md
│   │   → Documents the migration between model implementations/configurations.
│   │
│   ├── DEPLOYMENT_GUIDE.md
│   │   → Describes deployment steps for the production system.
│   │
│   ├── MODEL_CONFIGURATION.md
│   │   → Documents model paths, model settings, and inference configuration.
│   │
│   ├── Overview.md
│   │   → General system and repository overview.
│   │
│   ├── REFACTORING_COMPLETION_SUMMARY.md
│   │   → Summarizes completed architecture and code refactoring work.
│   │
│   ├── SETUP_COMPLETE.md
│   │   → Records completed environment and project setup state.
│   │
│   └── SETUP_GUIDE.md
│       → Step-by-step local project setup instructions.
│
│
├── infrastructure/
│   └── docker/
│       └── docker-compose.yml
│           → Defines PostgreSQL, Redis, API, RAG, neural generator, and crawler containers.
│
│
├── services/
│   │   → Python backend workspace containing the API and supporting runtime services.
│   │
│   ├── .env.example
│   │   → Example backend environment-variable configuration without production secrets.
│   │
│   ├── .gitignore
│   │   → Backend-specific Git ignore rules.
│   │
│   ├── Pyproject.toml
│   │   → Python project metadata and tooling configuration.
│   │
│   ├── README.md
│   │   → Backend services overview and development documentation.
│   │
│   ├── app.py
│   │   → Thin compatibility entrypoint forwarding execution to the core API application.
│   │
│   └── api/
│       │   → Core FastAPI backend and colocated crawler, RAG, and inference services.
│       │
│       ├── .dockerignore
│       │   → Excludes unnecessary files from the API Docker build.
│       │
│       ├── Dockerfile
│       │   → Builds the main FastAPI application container.
│       │
│       ├── README.md
│       │   → API-specific setup and architecture documentation.
│       │
│       ├── __init__.py
│       │   → Marks the API directory as a Python package.
│       │
│       ├── ci-test.txt
│       │   → Backend CI validation artifact.
│       │
│       ├── entrypoint.sh
│       │   → Runs database migrations before starting Uvicorn.
│       │
│       ├── monitor.py
│       │   → Standalone service health and runtime metrics monitor.
│       │
│       ├── requirements.txt
│       │   → Python dependencies required by the core API container.
│       │
│       ├── run_migrations.py
│       │   → Discovers and executes SQL migrations in version order.
│       │
│       ├── test_imports.py
│       │   → Verifies that important backend modules import successfully.
│       │
│       │
│       ├── database/
│       │   └── migrations/
│       │       │   → Ordered SQL schema migrations defining the PostgreSQL database.
│       │       │
│       │       ├── 001_users.sql
│       │       │   → Creates the core users and authentication schema.
│       │       │
│       │       ├── 002_resumes.sql
│       │       │   → Adds resume storage and resume-related tables.
│       │       │
│       │       ├── 003_jobs.sql
│       │       │   → Creates job listing and job data structures.
│       │       │
│       │       ├── 004_subscriptions.sql
│       │       │   → Introduces user subscription and payment records.
│       │       │
│       │       ├── 005_repo_docs.sql
│       │       │   → Adds repository document and generated documentation storage.
│       │       │
│       │       ├── 006_subscriptions_unique_constraint.sql
│       │       │   → Enforces subscription uniqueness constraints.
│       │       │
│       │       ├── 007_migrate_stripe_to_razorpay.sql
│       │       │   → Migrates legacy Stripe fields and schema to Razorpay.
│       │       │
│       │       ├── 008_otp_auth.sql
│       │       │   → Adds OTP-based email authentication structures.
│       │       │
│       │       ├── 009_async_jobs.sql
│       │       │   → Adds persistent asynchronous AI job tracking.
│       │       │
│       │       ├── 010_linkedin_optimizer.sql
│       │       │   → Adds LinkedIn analysis and optimization history.
│       │       │
│       │       ├── 011_job_trust_and_ranking.sql
│       │       │   → Adds job trust, quality, and ranking metadata.
│       │       │
│       │       └── 012_guest_users.sql
│       │           → Introduces temporary guest-user sessions.
│       │
│       ├── src/
│       │   │   → Main FastAPI application source code.
│       │   │
│       │   ├── __init__.py
│       │   │   → Marks the source directory as a Python package.
│       │   │
│       │   ├── api/
│       │   │   │   → Code-review and self-healing API endpoint layer.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the API routes package.
│       │   │   │
│       │   │   ├── routes.py
│       │   │   │   → Exposes code review and automatic fix endpoints.
│       │   │   │
│       │   │   └── routes_self_healing.py
│       │   │       → Exposes combined code fix-and-validation endpoints.
│       │   │
│       │   ├── configs/
│       │   │   │   → Application, database, Redis, and ML configuration modules.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the configuration package.
│       │   │   │
│       │   │   ├── config.py
│       │   │   │   → Loads environment-based application settings using Pydantic.
│       │   │   │
│       │   │   ├── db.py
│       │   │   │   → Creates and manages the asyncpg PostgreSQL connection pool.
│       │   │   │
│       │   │   ├── ml_config.py
│       │   │   │   → Stores machine-learning and model runtime configuration.
│       │   │   │
│       │   │   ├── redis.py
│       │   │   │   → Initializes Redis with graceful fallback when unavailable.
│       │   │   │
│       │   │   └── settings.py
│       │   │       → Additional centralized application settings definitions.
│       │   │
│       │   ├── core/
│       │   │   │   → FastAPI application bootstrap and shared core infrastructure.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the core application package.
│       │   │   │
│       │   │   ├── app.py
│       │   │   │   → Primary FastAPI application factory and production API entrypoint.
│       │   │   │
│       │   │   ├── app_self_healing.py
│       │   │   │   → Alternate FastAPI application focused on self-healing code flows.
│       │   │   │
│       │   │   ├── dependencies.py
│       │   │   │   → Defines reusable FastAPI dependency injection helpers.
│       │   │   │
│       │   │   └── exceptions.py
│       │   │       → Defines shared application exception types and error handling.
│       │   │
│       │   ├── middleware/
│       │   │   │   → Request authentication and traffic-control middleware.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the middleware package.
│       │   │   │
│       │   │   ├── auth.py
│       │   │   │   → Decodes JWT bearer tokens and resolves authenticated users.
│       │   │   │
│       │   │   └── rate_limit.py
│       │   │       → Implements Redis-backed per-user and per-IP rate limiting.
│       │   │
│       │   ├── routes/
│       │   │   │   → Domain-oriented FastAPI HTTP route modules.
│       │   │   │
│       │   │   ├── async_jobs.py
│       │   │   │   → Provides endpoints for polling asynchronous AI job status.
│       │   │   │
│       │   │   ├── auth.py
│       │   │   │   → Handles OTP requests, OTP verification, login, and guest sessions.
│       │   │   │
│       │   │   ├── github.py
│       │   │   │   → Handles GitHub OAuth, repositories, README flows, and terminal access.
│       │   │   │
│       │   │   ├── jobs.py
│       │   │   │   → Provides job search, ranking, featured, listing, and detail APIs.
│       │   │   │
│       │   │   ├── linkedin.py
│       │   │   │   → Provides LinkedIn analysis, unlock, and history APIs.
│       │   │   │
│       │   │   ├── resume.py
│       │   │   │   → Provides resume generation, creation, retrieval, and listing APIs.
│       │   │   │
│       │   │   ├── review.py
│       │   │   │   → Exposes code review operations through the domain route layer.
│       │   │   │
│       │   │   ├── subscription.py
│       │   │   │   → Handles Razorpay checkout, subscription status, and payment webhooks.
│       │   │   │
│       │   │   └── webhooks.py
│       │   │       → Receives and processes external GitHub webhook events.
│       │   │
│       │   ├── schemas/
│       │   │   │   → Pydantic API validation and serialization models.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the schemas package.
│       │   │   │
│       │   │   └── models.py
│       │   │       → Defines shared request and response data models.
│       │   │
│       │   ├── services/
│       │   │   │   → Business logic, AI orchestration, integrations, and domain services.
│       │   │   │
│       │   │   ├── __init__.py
│       │   │   │   → Marks the service layer package.
│       │   │   │
│       │   │   ├── ai_service.py
│       │   │   │   → Wraps model and local neural-generator interactions.
│       │   │   │
│       │   │   ├── analysis_engine.py
│       │   │   │   → Detects code security, bug, and style issues using deterministic patterns.
│       │   │   │
│       │   │   ├── auto_fixer.py
│       │   │   │   → Produces automatic code fixes for detected issues.
│       │   │   │
│       │   │   ├── code_preprocessor.py
│       │   │   │   → Cleans and prepares submitted source code before analysis.
│       │   │   │
│       │   │   ├── email_service.py
│       │   │   │   → Sends authentication OTP emails through Resend.
│       │   │   │
│       │   │   ├── github.py
│       │   │   │   → Provides lower-level GitHub integration functionality.
│       │   │   │
│       │   │   ├── github_service.py
│       │   │   │   → Wraps GitHub API calls and repository operations.
│       │   │   │
│       │   │   ├── job_queue.py
│       │   │   │   → Creates, executes, and tracks background AI jobs.
│       │   │   │
│       │   │   ├── jobs_service.py
│       │   │   │   → Implements job query, filtering, and ranking business logic.
│       │   │   │
│       │   │   ├── linkedin_ai_service.py
│       │   │   │   → Uses the local LLM to generate LinkedIn rewrite suggestions.
│       │   │   │
│       │   │   ├── linkedin_rules.py
│       │   │   │   → Implements deterministic LinkedIn profile scoring rules.
│       │   │   │
│       │   │   ├── linkedin_service.py
│       │   │   │   → Orchestrates LinkedIn analysis, scoring, and persistence.
│       │   │   │
│       │   │   ├── metrics.py
│       │   │   │   → Collects application and service runtime metrics.
│       │   │   │
│       │   │   ├── postprocessor.py
│       │   │   │   → Cleans, normalizes, and formats raw model-generated output.
│       │   │   │
│       │   │   ├── resume_ai_service.py
│       │   │   │   → Generates AI-assisted resume content.
│       │   │   │
│       │   │   ├── resume_pdf_service.py
│       │   │   │   → Compiles generated resume data into PDF using LaTeX.
│       │   │   │
│       │   │   ├── resume_service.py
│       │   │   │   → Orchestrates resume persistence and resume-domain operations.
│       │   │   │
│       │   │   ├── resume_template_service.py
│       │   │   │   → Loads and manages resume templates.
│       │   │   │
│       │   │   ├── review_service.py
│       │   │   │   → Coordinates preprocessing, issue detection, AI review, and output formatting.
│       │   │   │
│       │   │   ├── subscription_service.py
│       │   │   │   → Implements Razorpay subscription and plan business logic.
│       │   │   │
│       │   │   ├── terminal_manager.py
│       │   │   │   → Creates and manages WebSocket terminal sessions.
│       │   │   │
│       │   │   └── validation_engine.py
│       │   │       → Re-analyzes code to validate automatically generated fixes.
│       │   │
│       │   └── utils/
│       │       │   → Shared cryptography, logging, and model-management utilities.
│       │       │
│       │       ├── __init__.py
│       │       │   → Marks the utilities package.
│       │       │
│       │       ├── crypto.py
│       │       │   → Encrypts and decrypts stored GitHub tokens using Fernet.
│       │       │
│       │       ├── logger.py
│       │       │   → Configures structured JSON application logging.
│       │       │
│       │       └── model_downloader.py
│       │           → Downloads and caches Hugging Face models such as CodeBERT.
│       │
│       ├── templates/
│       │   └── resume_template.tex
│       │       → LaTeX template used to render generated resumes as PDFs.
│       │
│       │
│       ├── crawler/
│       │   │   → Independent batch service for collecting and processing job listings.
│       │   │
│       │   ├── Dockerfile
│       │   │   → Builds the lightweight crawler container.
│       │   │
│       │   ├── README.md
│       │   │   → Documents crawler architecture and execution.
│       │   │
│       │   ├── package.json
│       │   │   → Node package metadata retained for crawler tooling.
│       │   │
│       │   ├── package-lock.json
│       │   │   → Locks Node dependencies used by crawler tooling.
│       │   │
│       │   ├── requirements.txt
│       │   │   → Python dependencies required by scrapers and processors.
│       │   │
│       │   └── src/
│       │       ├── __init__.py
│       │       │   → Marks crawler source as a Python package.
│       │       │
│       │       ├── config.py
│       │       │   → Loads crawler source and database configuration.
│       │       │
│       │       ├── index.py
│       │       │   → Main crawler entrypoint that runs all enabled scrapers and exits.
│       │       │
│       │       ├── utils.py
│       │       │   → Shared crawler HTTP, parsing, and data utility functions.
│       │       │
│       │       ├── processors/
│       │       │   ├── __init__.py
│       │       │   │   → Marks crawler processors as a package.
│       │       │   ├── dedupe.py
│       │       │   │   → Removes exact and fuzzy duplicate job listings.
│       │       │   ├── enricher.py
│       │       │   │   → Adds derived metadata to normalized jobs.
│       │       │   ├── normalizer.py
│       │       │   │   → Converts source-specific jobs into one canonical schema.
│       │       │   └── trust.py
│       │       │       → Scores source, company, and application-domain trustworthiness.
│       │       │
│       │       └── scrapers/
│       │           ├── __init__.py
│       │           │   → Marks source scraper modules as a package.
│       │           ├── base.py
│       │           │   → Defines shared scraper behaviour and source interface.
│       │           ├── company_portals.py
│       │           │   → Collects jobs directly from supported company career portals.
│       │           ├── cutshort.py
│       │           │   → Collects job listings from Cutshort.
│       │           ├── glassdoor.py
│       │           │   → Collects job listings from Glassdoor.
│       │           ├── indeed.py
│       │           │   → Collects job listings from Indeed.
│       │           ├── internshala.py
│       │           │   → Collects internship listings from Internshala.
│       │           ├── linkedin.py
│       │           │   → Collects job listings from LinkedIn.
│       │           ├── naukri.py
│       │           │   → Collects job listings from Naukri.
│       │           ├── unstop.py
│       │           │   → Collects internship and job opportunities from Unstop.
│       │           └── wellfound.py
│       │               → Collects startup job listings from Wellfound.
│       │
│       │
│       ├── rag/
│       │   │   → Retrieval-Augmented Generation service running independently on port 8001.
│       │   │
│       │   ├── .dockerignore
│       │   │   → Excludes unnecessary files from the RAG Docker build.
│       │   │
│       │   ├── Dockerfile
│       │   │   → Builds the MiniLM and FAISS RAG service container.
│       │   │
│       │   ├── README.md
│       │   │   → Documents RAG architecture and API usage.
│       │   │
│       │   ├── requirements.txt
│       │   │   → Python dependencies for embeddings and vector search.
│       │   │
│       │   └── src/
│       │       ├── .env.example
│       │       │   → Example RAG environment-variable configuration.
│       │       ├── __init__.py
│       │       │   → Marks RAG source as a Python package.
│       │       ├── app.py
│       │       │   → RAG FastAPI application entrypoint listening on port 8001.
│       │       ├── config.py
│       │       │   → Loads embedding, vector-store, and neural-generator configuration.
│       │       ├── routes.py
│       │       │   → Exposes repository indexing and README generation endpoints.
│       │       ├── models/
│       │       │   └── schemas.py
│       │       │       → Defines RAG API request and response schemas.
│       │       └── services/
│       │           ├── __init__.py
│       │           │   → Marks RAG service modules as a package.
│       │           ├── chunker.py
│       │           │   → Splits repository source files into retrieval-sized text chunks.
│       │           ├── embedder.py
│       │           │   → Encodes repository chunks using all-MiniLM-L6-v2 embeddings.
│       │           ├── generator.py
│       │           │   → Builds grounded prompts from retrieved code and calls Qwen inference.
│       │           └── vector_store.py
│       │               → Creates, searches, saves, and loads FAISS vector indexes.
│       │
│       │
│       └── neural_generator/
│           │   → Dedicated local LLM inference microservice running on port 8002.
│           │
│           ├── .dockerignore
│           │   → Excludes unnecessary files from the neural-generator Docker build.
│           │
│           ├── Dockerfile
│           │   → Builds the llama.cpp-based Qwen inference container.
│           │
│           ├── README.md
│           │   → Documents neural-generator setup and inference API.
│           │
│           ├── __init__.py
│           │   → Marks the neural generator as a Python package.
│           │
│           ├── requirements.txt
│           │   → Defines llama-cpp-python and inference dependencies.
│           │
│           └── src/
│               ├── __init__.py
│               │   → Marks neural-generator source as a Python package.
│               │
│               └── app.py
│                   → Loads the Qwen3 0.6B GGUF model and exposes the port 8002 generation API.
│
│
└── tests/
    │   → Root-level automated test suite and Pytest configuration.
    │
    ├── __init__.py
    │   → Marks the tests directory as a Python package.
    │
    ├── pytest.ini
    │   → Configures Pytest discovery and execution behaviour.
    │
    └── test_basic.py
        → Contains basic application and project sanity tests.
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








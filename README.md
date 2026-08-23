# RepoSense

RepoSense is a job-search and developer-productivity platform. It aggregates
internship/job listings and hackathons from dozens of external sources, and
gives users AI-assisted tools to act on them — resume building, ATS scoring,
AI code review, a LinkedIn profile analyzer, a GitHub-connected terminal, and
a LeetCode practice judge.

> **Naming note:** the product is branded RepoSense throughout the UI, but
> `apps/web/package.json` still uses the legacy package name `internship-web`
> and the public site domain is `intern-flow.in` — both predate the rename
> and are left as-is rather than churned for cosmetics. See
> `apps/OVERVIEW.md` for details.

## Repository layout

```
apps/web/               Next.js frontend (App Router, TypeScript, Tailwind)
services/api/            Python/FastAPI backend and its sub-services
  src/                    Core API: auth, jobs, resume, ATS, review, dashboard, etc.
  crawler/                Scheduled scraper that ingests jobs/hackathons from external boards
  rag/                     Retrieval-augmented documentation/Q&A microservice
  neural_generator/       Local LLM (llama.cpp) text-generation microservice
  loadtest/                k6 load-testing scripts for the core API
  database/migrations/     SQL schema migrations
infrastructure/docker/   docker-compose stack for local/prod deployment
scripts/                  Standalone maintenance/content-generation scripts
docs/                     Setup, deployment, and migration guides
tests/                    Repo-level Python tests
```

## Public SEO surface

Alongside the authenticated product, `apps/web` serves a set of statically
and dynamically generated hub pages that exist purely to be crawled and
ranked. All of them read from the same `getJobs()` plumbing in `lib/jobs.ts`
— they're views over live listing data, not separate content databases.

| Route | What it is | Data source |
|---|---|---|
| `/jobs`, `/internships` | Primary paginated listings | `getJobs()` |
| `/remote-jobs`, `/government-jobs` | Category listings + detail pages | `getJobs({ category })` |
| `/japan-jobs`, `/europe-jobs` | Country listings (server-side `country` filter) | `getJobs({ country })` |
| `/jobs-in/[city]` | 5 Indian-city hub pages (Bangalore, Hyderabad, Chennai, Pune, Delhi NCR) — the API only filters by country, so city matching happens client-side against each job's `location` string | `apps/web/app/jobs-in/data.ts` |
| `/companies`, `/companies/[company]` | Company hub pages | `getCompanies()` / `lib/companies.ts` |
| `/skills/[skill]` | 24 skill hub pages (Python, React, AWS, etc.) | `apps/web/app/skills/data.ts` |
| `/careers/[role]` | 5 career-path hubs — what the role does, skills, live openings, resume-guide cross-link | `apps/web/app/careers/data.ts` |
| `/resume-for/[role]` | 5 resume guides — ATS keywords, common mistakes, bullet templates for the same 5 roles the `/ats-checker` tool supports | `apps/web/app/resume-for/data.ts` |
| `/tools`, `/tools/[tool]` | Marketing pages for each AI tool (README generator, ATS checker, resume builder, etc.) | `apps/web/app/tools/data.ts` |
| `/hackathons` | Hackathon listings | backend hackathons API |
| `/blog/[slug]` | Programmatic SEO blog posts, one per targeted keyword | `content/blog/*.json`, tracked in `content/seo/keywords.json` |

Every one of these has a matching `sitemap-*.xml` route, all indexed from
`app/sitemap.xml/route.ts`. `sitemap-jobs.xml` fetches paginated batches of
every live listing in parallel (`Promise.allSettled`) rather than
sequentially — a prior sequential version was prone to serverless timeouts
truncating the response mid-file.

`content/seo/keywords.json` is the backlog: each entry tracks a target
keyword, its category, priority, and (once written) the published slug.
`scripts/generate-daily-posts.mjs` is the automation that turns queued
keywords into blog posts.

## Services and ports

| Service           | Path                             | Default port |
|--------------------|-----------------------------------|---------------|
| Core API           | `services/api/src`                | 8000          |
| RAG service         | `services/api/rag`                | 8001          |
| Neural generator    | `services/api/neural_generator`   | 8002          |
| Web frontend        | `apps/web`                         | 3000          |
| Postgres            | —                                   | 5432          |
| Redis               | —                                   | 6379          |

## Quick start

```bash
# start Postgres, Redis, and the microservices via Docker
make build
make dev          # docker-compose up + frontend/backend dev servers

# run database migrations
make migrate

# run tests
make test
```

`make dev` starts the Docker stack (`infrastructure/docker/docker-compose.yml`),
then runs the Next.js dev server (`apps/web`) and the FastAPI dev server
(`services/api`) locally with hot reload. See each sub-directory's README for
service-specific setup, environment variables, and endpoints.

## Deployment

Production deploys to AWS via Terraform (`make deploy`). See
`docs/DEPLOYMENT_GUIDE.md` for details.

# RepoSense

RepoSense is a job-search and developer-productivity platform. It aggregates
internship/job listings and hackathons from dozens of external sources, and
gives users AI-assisted tools to act on them — resume building, ATS scoring,
AI code review, a LinkedIn profile analyzer, a GitHub-connected terminal, and
a LeetCode practice judge.

## Repository layout

```
apps/web/              Next.js frontend (App Router, TypeScript, Tailwind)
services/api/           Python/FastAPI backend and its sub-services
  src/                   Core API: auth, jobs, resume, ATS, review, dashboard, etc.
  crawler/               Scheduled scraper that ingests jobs/hackathons from external boards
  rag/                    Retrieval-augmented documentation/Q&A microservice
  neural_generator/      Local LLM (llama.cpp) text-generation microservice
  loadtest/               k6 load-testing scripts for the core API
  database/migrations/    SQL schema migrations
infrastructure/docker/  docker-compose stack for local/prod deployment
scripts/                 Standalone maintenance/content-generation scripts
docs/                    Setup, deployment, and migration guides
tests/                   Repo-level Python tests
```

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

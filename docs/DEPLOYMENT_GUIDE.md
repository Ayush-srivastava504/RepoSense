# RepoSense — Deployment Guide

> This file is linked from the root README, `services/README.md`, `services/api/README.md`, and `apps/web/README.md`, but didn't exist yet. This is the first version, written directly off the actual CI/CD workflow and Docker Compose file in this repo rather than an idealized plan.

## What deployment tooling actually exists today

| Thing | Status |
|---|---|
| Docker Compose (`infrastructure/docker/docker-compose.yml`) | ✅ Exists, is the supported way to run everything together |
| GitHub Actions CI/CD (`.github/workflows/backend-cicd.yml`) | ✅ Exists — test → build/push images → deploy to EC2 → smoke test → scheduled health monitor |
| Prebuilt container images on GHCR | ✅ `reposense-api`, `reposense-rag`, `reposense-neural` |
| Terraform (`infrastructure/terraform/`) | ❌ Referenced by `make deploy` but the directory doesn't exist in this repo |
| `scripts/deploy.sh` | ❌ Referenced by `make deploy` but doesn't exist |
| Railway config | ❌ Not present, despite being mentioned in older docs |
| Frontend deploy step in CI | ❌ The workflow only builds/deploys the three backend images; `apps/web` is not built or deployed by this pipeline |

In short: **the real deployment path is GitHub Actions → GHCR → SSH into one EC2 box → `docker compose pull && docker compose up -d`.** `make deploy` in the root Makefile is aspirational/stale and will fail (`infrastructure/terraform` and `scripts/deploy.sh` don't exist) — don't use it.

## Automated deployment (what actually runs today)

`.github/workflows/backend-cicd.yml` triggers on push to `master` (paths under `services/api/**`, `infrastructure/docker/**`, or `tests/**`), on pull requests, on manual dispatch, and on a `*/15 * * * *` cron for health monitoring. It has four jobs:

### 1. `test`
Spins up ephemeral `postgres:15` and `redis:7-alpine` service containers, installs `services/api/requirements.txt` plus `pytest pytest-asyncio pytest-cov httpx`, runs all 12 migrations against a throwaway `internship_db_test` database, runs `test_imports.py` as an import smoke test, then runs `pytest ../../tests/ --cov=src` and uploads a coverage artifact. Required env vars are fake-but-valid CI values (e.g. a dummy 32-char `JWT_SECRET`, a base64 `GITHUB_TOKEN_ENCRYPTION_KEY`) — there's no real GitHub OAuth app or database used in CI.

### 2. `build` (only on push to `master`, after `test` passes)
Logs into `ghcr.io` with the built-in `GITHUB_TOKEN` and builds/pushes three images, each tagged `:latest` and `:<commit-sha>`:

```
ghcr.io/ayush-srivastava504/reposense-api:latest        (from services/api/Dockerfile)
ghcr.io/ayush-srivastava504/reposense-rag:latest        (from services/api/rag/Dockerfile)
ghcr.io/ayush-srivastava504/reposense-neural:latest     (from services/api/neural_generator/Dockerfile)
```

The crawler is **not** built or pushed here — it's built locally on the EC2 box (`target: dev` in its multi-stage Dockerfile), not shipped as a GHCR image, and isn't part of this CI/CD pipeline at all. Its scheduling is EC2 + Docker + cron: a cron entry on the box periodically runs the container (`docker compose run --rm crawler` or a plain `docker run`), it scrapes once and exits, cron fires it again next interval. There is no Lambda function and no `reposense-crawler` image on GHCR — see [services/api/crawler/README.md](../services/api/crawler/README.md) for the full picture, including the Dockerfile's unused legacy Lambda build stages.

### 3. `deploy` (after `build` succeeds)
SSHes into a single EC2 host (`secrets.EC2_HOST` / `secrets.EC2_SSH_KEY`, user `ec2-user`) and runs, in `/home/ec2-user/RepoSense`:

```bash
git pull
docker compose -f infrastructure/docker/docker-compose.yml pull api rag neural-generator
docker compose -f infrastructure/docker/docker-compose.yml up -d api rag neural-generator
```

Then polls `http://localhost:8000/health` up to 12 times (10s apart) waiting for `200`. Note this step does **not** touch `postgres`, `redis`, or `crawler` — those are assumed to already be running on the box from a prior `docker compose up -d`, or to be started separately. It also doesn't run migrations — you run `python services/api/run_migrations.py` yourself after schema changes.

### 4. `smoke` (after `deploy` succeeds)
SSHes in again and curls `/health` on all three services (ports 8000, 8001, 8002 on `localhost`, i.e. from inside the EC2 box) to confirm they returned `200`.

### `health_monitor` (separate: runs on the 15-minute cron, not after deploy)
SSHes in and runs `monitor.py` (with `ALERT_WEBHOOK_URL` set from a secret), then posts to a webhook if the job fails. This is a scheduled check, independent of the deploy pipeline — it's not part of the same run that ships new code.

**Required GitHub Actions secrets:** `EC2_HOST`, `EC2_SSH_KEY`, `ALERT_WEBHOOK` (optional — failure alert is skipped silently if unset). `GITHUB_TOKEN` for GHCR push is automatic, not a secret you set.

## Manual deployment (first-time EC2 setup, or without CI)

The workflow above assumes the EC2 box is already set up with the repo cloned and Postgres/Redis running. To do that setup once:

```bash
# On the EC2 instance
sudo yum install -y docker git
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user   # log out/in after this

git clone https://github.com/Ayush-srivastava504/RepoSense.git
cd RepoSense

# Create the .env the Core API reads (see services/api/README.md → Configuration
# for the full variable list). At minimum: DATABASE_URL, JWT_SECRET,
# GITHUB_CLIENT_ID/SECRET, GITHUB_TOKEN_ENCRYPTION_KEY, RAZORPAY_KEY_ID/SECRET,
# RESEND_API_KEY, FRONTEND_URL.
vim .env

# Bring up everything, including Postgres/Redis and a one-shot crawler run
docker compose -f infrastructure/docker/docker-compose.yml up -d

# Run migrations (not part of the compose file — do this explicitly)
python3 services/api/run_migrations.py
```

After that, subsequent deploys can either happen through the GitHub Actions pipeline above, or manually with:

```bash
cd /home/ec2-user/RepoSense
git pull
docker compose -f infrastructure/docker/docker-compose.yml pull api rag neural-generator
docker compose -f infrastructure/docker/docker-compose.yml up -d api rag neural-generator
```

## Deploying the frontend

`apps/web` is **not** part of the CI/CD pipeline or the Docker Compose file at all — there's no `web` service defined in `infrastructure/docker/docker-compose.yml`. The frontend is a plain Next.js app; the two realistic options are:

1. **Vercel** (or similar) — connect the repo, set the root directory to `apps/web`, set `NEXT_PUBLIC_API_URL` to your EC2 box's public URL/domain, and let its own CI build/deploy on push. This is a separate deployment surface from the backend and isn't wired into `backend-cicd.yml`.
2. **Same EC2 box** — `cd apps/web && npm install && npm run build && npm start`, fronted by a reverse proxy (nginx/Caddy) that also proxies `/api` to the Core API container on port 8000. Nothing in this repo sets this up for you; it's a manual reverse-proxy configuration you'd add yourself.

There's no committed nginx/Caddy config or Vercel project file in this repo, so whichever route you pick, that config lives outside this codebase today.

## Reverse proxy / TLS

Nothing in this repo terminates TLS or reverse-proxies the three backend ports — Compose exposes `8000`/`8001`/`8002` directly. For anything beyond local development, put a reverse proxy (nginx, Caddy, or a cloud load balancer) in front of port 8000 and terminate TLS there; the CI/CD `deploy` job above talks to `localhost:8000` directly on the EC2 box and doesn't configure this for you.

## Environment variables needed for deployment specifically

Beyond the app config in `services/api/README.md`, deployment itself needs:

```bash
# GitHub Actions secrets (Settings → Secrets → Actions)
EC2_HOST=<ec2 public ip or hostname>
EC2_SSH_KEY=<private key matching an authorized_keys entry on the box>
ALERT_WEBHOOK=<optional — Slack/Discord-style incoming webhook URL for health_monitor failures>
```

`GITHUB_TOKEN` used for the GHCR push is provided automatically by Actions — you don't set it yourself, and it only needs the `packages: write` permission already declared at the top of the workflow file.

## Rolling back

There's no automated rollback job in the workflow. To roll back manually on the EC2 box:

```bash
docker compose -f infrastructure/docker/docker-compose.yml pull \
  api@<previous-sha-tag> rag@<previous-sha-tag> neural-generator@<previous-sha-tag>
# or, simpler: pin the image tags in docker-compose.yml to a known-good <sha>
# instead of :latest, then `up -d` again
```

Since every image is also tagged with the triggering commit SHA (not just `:latest`), the SHA tags on GHCR are your rollback points — there's just no scripted way to select one yet.

## Troubleshooting deployment

| Symptom | Likely cause |
|---|---|
| `deploy` job times out waiting for `/health` | `.env` on the EC2 box is missing a required variable (see `services/api/README.md` → Configuration) and the API container is crash-looping; SSH in and run `docker compose logs api` |
| `build` job fails pushing to GHCR | `packages: write` permission missing, or the package visibility settings on the GHCR org block anonymous/first-time pushes |
| `smoke` job fails on the RAG or Neural Generator check | Those containers have a 180s `start_period` in their healthchecks (model load time) — a deploy immediately after a cold start can race ahead of that; check `docker compose ps` for actual health state |
| Frontend can't reach the API after deploy | `NEXT_PUBLIC_API_URL` in the frontend's build/env doesn't point at the EC2 box's public address, or nothing is reverse-proxying/exposing port 8000 externally |

## Related docs

- [services/api/README.md](../services/api/README.md) — full environment variable and configuration reference
- [services/README.md](../services/README.md) — Docker Compose usage for local development
- [docs/SETUP_GUIDE.md](./SETUP_GUIDE.md) — local setup, not deployment

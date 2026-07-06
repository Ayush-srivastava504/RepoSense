# RepoSense Job Crawler

> A one-shot CLI batch job (not a persistent HTTP service) that scrapes 9 sources, normalizes/dedupes/enriches/scores the results, and writes them into the shared PostgreSQL `jobs` table.

## Overview

The crawler lives at `services/api/crawler/` and runs as `python src/index.py`. It's invoked manually, on a schedule (cron/CI), or once at container start by Docker Compose — it is **not** started with `uvicorn` and has no HTTP endpoints of its own.

## Pipeline

```
Scraper (per-source: LinkedIn, Indeed, Naukri, Internshala, Wellfound,
         Unstop, Glassdoor, Cutshort, company_portals)
    ↓
processors/normalizer.py    — maps each source's raw fields onto a canonical schema
    ↓
processors/dedupe.py        — fuzzy-matches title+company+location to drop duplicates
    ↓
processors/enricher.py      — keyword-based category tagging (e.g. "Software Engineering")
    ↓
processors/trust.py         — company/domain trust scoring for badges & ranking
    ↓
PostgreSQL `jobs` table
```

`processors/dedupe.py` prefers `rapidfuzz` for fuzzy string matching and falls back to the standard-library `difflib` with a warning if `rapidfuzz` isn't installed — both are listed in `requirements.txt`, so this fallback shouldn't normally trigger, but it's there if the optional dependency fails to build.

`processors/trust.py` is explicitly additive by design (see its module docstring) — it never touches scraping/normalization/dedup/enrichment output, it only reads `company` and `apply_url` off an already-processed job dict and attaches a trust score and a small number of flags (e.g. whether the apply URL matches a manually curated list of official company domains) for the API layer to use in badges and ranking.

## Sources (9 scrapers)

| Source | File |
|---|---|
| LinkedIn | `src/scrapers/linkedin.py` |
| Indeed | `src/scrapers/indeed.py` |
| Naukri | `src/scrapers/naukri.py` |
| Internshala | `src/scrapers/internshala.py` |
| Wellfound | `src/scrapers/wellfound.py` |
| Unstop | `src/scrapers/unstop.py` |
| Glassdoor | `src/scrapers/glassdoor.py` |
| Cutshort | `src/scrapers/cutshort.py` |
| Company portals | `src/scrapers/company_portals.py` |

All scrapers subclass `BaseScraper` (`src/scrapers/base.py`), which owns a shared Playwright Chromium instance per run (launched with `--disable-dev-shm-usage --no-sandbox --disable-gpu --disable-setuid-sandbox`) and gives subclasses a `session` (via `utils.make_session()`) for scrapers that only need `requests`/BeautifulSoup rather than a real browser — set `uses_browser = False` on those subclasses to skip the Chromium launch entirely. A 120-second navigation timeout is applied via `NAV_TIMEOUT_MS`.

## Running the Crawler

```bash
cd services/api/crawler
pip install -r requirements.txt
playwright install chromium   # one-time browser install

# Default run — all scrapers, CLI default is 3 pages per source
python src/index.py

# Specific scrapers (comma-separated within one --scrapers value, or
# space-separated multiple values — argparse nargs="+" accepts either)
python src/index.py --scrapers linkedin,indeed,naukri --max-pages 5

# Custom keywords / locations (space-separated, overrides config.py defaults)
python src/index.py --keywords "backend intern" "ml engineer" --locations Bangalore Remote

# Dry run — runs the full pipeline but skips the DB write
python src/index.py --dry-run
```

`--scrapers` sets the `ENABLED_SCRAPERS` environment variable internally rather than being passed straight through — passing it re-splits on commas even if you space-separated multiple `--scrapers` values, so `--scrapers linkedin,indeed` and `--scrapers linkedin indeed` behave the same.

Note the CLI's own `--max-pages` default is **3**, which is different from `MAX_PAGES_PER_SOURCE` in `config.py` (default **10**) — the CLI flag takes precedence when passed; `MAX_PAGES_PER_SOURCE` is a separate, currently-unused-by-the-CLI config constant unless something else reads it directly.

The pipeline prints a JSON summary to stdout on completion (`run_pipeline()`'s return value).

## Configuration (`src/config.py`)

All values are overridable via environment variables:

```bash
MAX_WORKERS=8
REQUEST_TIMEOUT=30
MAX_RETRIES=3
RETRY_BACKOFF=2.0
RATE_LIMIT_DELAY=1.5
USE_PROXY=false
PROXY_LIST=              # comma-separated, only read if USE_PROXY=true
ROTATE_UA=true
HEADLESS=true
CHROME_BINARY=/usr/bin/google-chrome
CHROMEDRIVER_PATH=/usr/bin/chromedriver
PAGE_LOAD_TIMEOUT=60
MAX_PAGES_PER_SOURCE=10   # see note above re: CLI --max-pages taking precedence

# Site credentials (only needed if a scraper logs in rather than scraping public listings)
LINKEDIN_EMAIL / LINKEDIN_PASSWORD
NAUKRI_EMAIL / NAUKRI_PASSWORD

# Legacy/possibly-unused storage config — confirm against utils.py/index.py
# before assuming these do anything in your deployment
S3_BUCKET=job-crawler-raw
S3_PREFIX=jobs/
DYNAMODB_TABLE=jobs
AWS_REGION=ap-south-1
```

`CHROME_BINARY`/`CHROMEDRIVER_PATH` are Selenium-era leftovers — the actual scraping stack today is Playwright (`scrapers/base.py`), which manages its own bundled Chromium rather than reading these paths. They're harmless to set but likely don't affect Playwright-based scrapers.

## Docker — current model is EC2 + Docker + cron, not Lambda

The crawler runs today as a **Docker container triggered by cron on the same EC2 box that runs the rest of the stack** — not as an AWS Lambda function. The production pattern is: cron fires on a schedule → runs the crawler container once (`docker run` or `docker compose run`) → it executes one crawl of all 9 sources and exits → cron fires again next interval. There's no always-on crawler process and no Lambda invocation in the current deployment.

`Dockerfile` in this directory still has **three build stages** left over from before this migration, and only one of them is actually used:

```dockerfile
FROM public.ecr.aws/lambda/python:3.11 AS builder   # pre-migration Lambda build stage — unused today
FROM public.ecr.aws/lambda/python:3.11 AS final     # pre-migration Lambda runtime stage — unused today
FROM python:3.11-slim AS dev                         # what actually gets built and run
```

`infrastructure/docker/docker-compose.yml` builds this Dockerfile with `target: dev` — a plain `python:3.11-slim` image with `chromium`/`chromium-driver` apt packages plus Playwright's own bundled Chromium install. This `dev`-target image is what cron runs on the EC2 box. The `builder`/`final` stages targeting `public.ecr.aws/lambda/python` are dead code from the earlier Lambda-based attempt (dropped over issues like pyppeteer/glibc mismatches, ephemeral `/tmp`, and a missing Playwright install in the Lambda runtime) — nothing in the current CI/CD pipeline, Compose file, or cron setup builds, pushes, or invokes them, and there is no Lambda function or `reposense-crawler` image on GHCR today. Don't target `builder`/`final` expecting them to work in the current environment.

```bash
# What actually runs, whether invoked manually or by cron
docker build --target dev -t reposense-crawler:dev .
docker run --rm --env-file ../../../.env reposense-crawler:dev \
  python src/index.py --scrapers internshala,naukri,linkedin,wellfound,indeed,unstop,glassdoor,cutshort,company_portals --max-pages 2

# Or via Compose (same target: dev build)
docker compose -f ../../../infrastructure/docker/docker-compose.yml run --rm crawler
```

Via Compose, the crawler's default `command` runs once against all 9 sources with `--max-pages 2` and exits. The service is declared with `restart: unless-stopped`, so `docker compose up -d crawler` will restart it every time it exits — fine for a one-off `docker compose up -d` of the whole stack, but not what you want if cron is meant to own scheduling. For a cron-driven setup, trigger runs with `docker compose run --rm crawler` (which doesn't inherit `restart:`) or a plain `docker run` from the cron entry itself, rather than leaving the Compose-managed container running.

## Verifying results

```sql
SELECT id, title, company, source, posted_at
FROM jobs
WHERE is_active = true
ORDER BY posted_at DESC
LIMIT 50;
```

## Scheduling

Production scheduling is **cron on the EC2 box**, not GitHub Actions — `.github/workflows/backend-cicd.yml` only covers the Core API/RAG/Neural Generator build-test-deploy pipeline and a separate 15-minute health-check cron for `monitor.py`; it never invokes the crawler. There's no crontab file committed in this repo (crontabs live on the box, not in version control), so the schedule itself isn't visible in-repo — what's confirmed is the mechanism: a cron entry on the EC2 host runs `docker run` (or `docker compose run --rm crawler`) against the `dev`-target image on an interval, each run scraping all 9 sources once and exiting. A representative crontab entry, run from the repo root on the EC2 box:

```cron
# Every 6 hours
0 */6 * * * cd /home/ec2-user/RepoSense && docker compose -f infrastructure/docker/docker-compose.yml run --rm crawler >> /var/log/reposense-crawler.log 2>&1
```

If you're setting this up fresh, that's the pattern to follow — add the actual crontab entry on the box (`crontab -e` as whichever user owns the Docker socket), since neither the frequency nor the crontab file itself is tracked in this repository.

## Related docs

- [services/README.md](../../README.md) — backend architecture overview
- [services/api/README.md](../README.md) — Core API that reads what the crawler writes
- [docs/DEPLOYMENT_GUIDE.md](../../../docs/DEPLOYMENT_GUIDE.md)

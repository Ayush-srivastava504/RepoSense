# crawler — Job & Hackathon Scraper

A scheduled Python pipeline (packaged for AWS Lambda) that scrapes jobs and
hackathons from ~30 external sources, normalizes/deduplicates/scores them,
and upserts the results into Postgres.

## Structure

```
src/
  index.py                  Job pipeline entrypoint (lambda_handler / run_pipeline)
  hackathon_index.py         Hackathon pipeline entrypoint
  config.py                   Keyword/location defaults, enabled-scraper list
  content_enrichment.py        Backfills richer job descriptions post-ingest
  utils.py                     Logging, S3, and Postgres upsert helpers
  scrapers/                    One module per job source (see below)
  scrapers/hackathons/          Hackathon-specific scrapers (Devfolio, Devpost, etc.)
  processors/
    normalizer.py / hackathon_normalizer.py   Shape raw listings into a common schema
    dedupe.py / hackathon_dedupe.py             Fuzzy/hash-based duplicate detection
    trust.py                                     Confidence/trust scoring for jobs
    hackathon_quality.py                          Quality filtering for hackathons
    hackathon_status.py                            Active/expired status resolution
    enricher.py                                    Enriches job records with extra fields
```

## Job sources

Controlled by `ENABLED_SCRAPERS` (comma-separated), default set includes:
Internshala, LinkedIn, HiringCafe, Unstop, Cutshort, generic company portals,
RemoteOK, We Work Remotely, Remotive, Japan job/internship boards, several
Europe-focused boards (Jobicy, Arbeitnow, Remotive, We Work Remotely,
RemoteOK), Employment News, FreeJobAlert, and ATS-native boards (Greenhouse,
Lever, Ashby, SmartRecruiters, Workable) plus a generic-boards fallback.

## Running locally

```bash
pip install -r requirements.txt
playwright install    # needed by scrapers that render JS
python -m src.index          # run the job pipeline once
python -m src.hackathon_index  # run the hackathon pipeline once
```

In production this runs as a scheduled AWS Lambda (see `Dockerfile`); the
`docker-compose.yml` also defines `job-crawler` and `hackathon-crawler`
services for local/containerized runs.

## Configuration

| Variable | Purpose |
|---|---|
| `ENABLED_SCRAPERS` | Comma-separated list of scraper modules to run |
| `MAX_PAGES_PER_SOURCE` | Pagination cap per source (default 10) |
| `DATABASE_URL` | Postgres connection string for upserts |
| AWS credentials | Used for S3 archival of raw scrape output |

## Node dependency

`package.json` pulls in `playwright` for the Node-side browser binaries that
the Python `playwright` package drives — no Node application code lives here.

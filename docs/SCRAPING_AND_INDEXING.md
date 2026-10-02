# How InternFlow scrapes and what gets indexed

## Scraping (services/api/crawler/src/index.py `run_pipeline`)
1. **Scrapers** (`ENABLED_SCRAPERS`, but in production the list in `infrastructure/docker/docker-compose.yml` is what actually runs):
   job boards (Internshala, Unstop, Cutshort, HiringCafe, LinkedIn), remote boards (RemoteOK, WWR, Remotive), government
   (FreeJobAlert, Employment News), Japan/Europe feeds, ATS APIs (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, ...
   over the board lists in `config.ATS_COMPANIES`), `company_portals` (HTML career pages: TCS, Tech Mahindra, Infosys, Wipro),
   and the new `big_tech_careers` (Amazon + Microsoft JSON search APIs).
2. `normalize` -> `dedupe` (in batch and against the DB) -> `enrich` -> `trust score` -> **quality gate** (rejects dead apply URLs,
   flags thin postings) -> `content_layer` -> `upsert_jobs` -> AI content enrichment -> deactivate stale jobs (30 d) + liveness check.

## What a visitor sees (routes/jobs.py)
`is_active` AND not past `deadline` AND posted within **10 days (internships) / 20 days (everything else)** (rows with no `posted_at` always pass).
- /jobs = everything except government; /internships = type internship; /remote-jobs = is_remote; /government-jobs = is_government.

## What Google is told to index
A job URL is indexable unless: stale (deadline passed, or posted_at + 45 d, or - for undated rows - created_at + 60 d), or thin with no AI overview.
The sitemap additionally requires an AI overview and applies age/quality tiers (`services/api/src/services/sitemap_builder.py`, mirrored by
`apps/web/lib/seo/seoMetrics.ts` - keep the two in step).

## Why a big company can be missing
It is lost at one of: (a) never scraped, (b) scraped but dropped by the quality gate, (c) stored but outside the freshness window,
(d) listed but not indexed. `scripts/diagnose_company_coverage.sql` shows which, per company.
- **Microsoft / Amazon**: were in no scraper at all (their sites are JS apps; `company_portals` reads HTML cards). Now covered by `big_tech_careers`.
- **TCS / Tech Mahindra**: configured in `config.COMPANY_PORTALS` as HTML scrapes, but ibegin.tcs.com is login-gated and internship.techmahindra.com is JS-rendered,
  so the selectors very likely match nothing. Run the diagnostic; if query 1 returns no rows for them, they need an API/ATS source (see their network tab) rather than more selectors.

## Big companies, Indian startups, YC-backed startups (Oct 2026)
Root cause of "Swiggy / Zomato / PwC / Razorpay are missing": the ATS scrapers only crawl board lists in `config.ATS_COMPANIES`, and that
list held ~50 mostly-US boards (6 on Lever, none Indian). A company that is not on a list is never fetched.
- `src/ats_candidates.py` now holds ~120 more candidate boards (Greenhouse/Lever/Ashby/SmartRecruiters/Workable) and is merged into `ATS_COMPANIES`.
- `scrapers/workday.py` (new) covers enterprises on Workday (PwC, NVIDIA, Adobe, Salesforce, Intel, Dell, Mastercard, Qualcomm, Walmart),
  India postings only, early-career queries.
- Slugs are unverified guesses (no internet in the build sandbox). Run `cd services/api/crawler && python probe_boards.py` on EC2 to see which exist.
- Companies on no public ATS (Deloitte, EY, KPMG, Accenture, Infosys, TCS, Zomato's own site) need their own scraper: see their network tab for the JSON API.
- New jobs from these sources are thin until AI enrichment runs, so they show on list pages first and enter the sitemap after they get an overview.

## Government jobs leaking into /jobs and /internships (Oct 2026)
Cause: migration 014 added `is_government DEFAULT FALSE` and never backfilled it, so government rows crawled earlier were `false` and passed
the `exclude_government` filter. Fix: the API now treats `source IN (freejobalert, employment_news, ssc, upsc)` as government too
(`GOVERNMENT_SOURCES_SQL` in routes/jobs.py), returns that effective flag on every row (so `/government-jobs/[slug]` no longer 404s legacy rows
and canonical paths are right), and `database/migrations/037_backfill_is_government.sql` fixes the stored data.
The API change must be DEPLOYED (rebuild the api container on EC2); the Vercel frontend alone does nothing, because the filtering happens in the API.

# InternFlow — Indexing Recovery Plan

Written after a Sep 2026 GSC review turned up four symptoms that all trace
back to the same root cause. This doc is the diagnosis + phased fix; treat
it as a sibling to PHASE_PLAN.md, not a replacement — Phase 3 there is
still open and independent of this.

## The four symptoms (GSC, Sep 15 2026)

- **Page indexing:** 15,312 URLs "Discovered — currently not indexed"
  (climbing), 4,083 "Page with redirect" (Failed), 829 "Alternate page
  with proper canonical tag" (Failed), 64 "Crawled - currently not
  indexed" (Failed).
- **Job Postings rich result:** only 10 valid, 3 invalid (2 critical) —
  tiny relative to 16k+ live listings.
- **Breadcrumbs rich result:** only 23 valid items total.
- User complaint: job-detail pages read as generic/interchangeable
  rather than detailed and unique.

## Root cause: one problem, four symptoms

Google is choosing not to crawl most of the site's URLs. It does this
deliberately when a large fraction of a site's pages look low-value or
near-duplicate at a glance. Two things in the current codebase produce
exactly that pattern:

1. **The AI content-enrichment pipelines never touch the existing
   backlog.** `crawler/src/content_enrichment.py` and
   `structured_enrichment.py` are only ever invoked as
   `run_content_enrichment_for_new_jobs(enriched)` /
   `run_structured_enrichment_for_jobs(enriched)` from `index.py` — the
   `enriched` list is *this crawl run's* newly-scraped jobs only, capped
   at `BATCH_LIMIT=250` each. There is no `bulk=True` backfill call
   anywhere. Any job scraped before these pipelines existed (or during
   the era content_enrichment.py's own comment describes — *"hardcoded
   at 60/run against a backlog in the thousands"*) stays thin forever.
2. **Thin, unenriched jobs get identical sitemap priority and remain
   indexable.** `JobDetail.tsx`'s `buildFallbackSummary()` renders a
   near-identical templated sentence for every under-enriched listing
   ("`{company} is hiring for the {title} {type} in {location}`...").
   `quality.py` already computes `is_thin`/`quality_score` per job and
   persists them — but `routes/jobs.py`'s `JOB_COLUMNS` never selects
   them, so nothing downstream (sitemap, indexing) can act on the
   signal. Every live job ships in `sitemap-jobs.xml` at the same
   `priority: 0.8`, thin or not, so Google has no signal about which
   pages are actually worth its crawl budget.

Everything else is downstream of this:

- **Job Postings report is small** because Google only extracts
  JobPosting data from pages it actually crawls, and it's barely
  crawling anything. The 3 *invalid* ones are a separate, smaller bug:
  `jobPostingSchema()` in `lib/structuredData.ts` sets
  `datePosted: job.posted_at` and only sets `jobLocation` when a
  location string exists — correct behavior (never fabricate data), but
  some scraped rows have neither, which silently produces an invalid
  `JobPosting` block. Matches "Missing field datePosted" (3) and
  "Missing field jobLocation" (1) exactly.
- **Breadcrumbs report is small** for the same crawl-starvation reason —
  it only reflects the sliver of pages Google has actually visited.
  Separately, breadcrumb schema is only wired into the four
  job/internship/remote/government *detail* templates — hub pages have
  none, which is PHASE_PLAN.md's existing Phase 3 item 4.
- **"Page with redirect" (4,083)** should already be fixed by the Aug
  SEO pass's BASE_URL correction (apex → www) — GSC's continued Failed
  count here is most likely stale validation data rather than a live
  bug, pending Phase 0 confirming the fix actually reached production.

## Phase 0 — Confirm what's actually live

Several fixes delivered across earlier sessions (BASE_URL/canonical,
sitemap `isLive` filtering, the duplicate-JobPosting-schema fix, the
duplicate-filter-bar removal) may or may not have reached production —
this repo has been handed over as zips, not deployed directly. Until
this is confirmed, none of the numbers above can be fully trusted as
"current state." **Status: in progress**, self-check handed to the site
owner (canonical tag on a live job page, one vs. two filter bars on
`/jobs`, live `robots.txt` contents, a `/companies/[x]` hub page,
deploy-pipeline mechanics).

## Phase A — Stop feeding Google low-value pages (sitemap discipline)

1. Add `is_thin`, `quality_score` to `JOB_COLUMNS` in `routes/jobs.py`
   so the API (and therefore the frontend) can see them.
2. `sitemap-jobs.xml`: exclude jobs that are `is_thin` **and** have no
   `enriched_overview` yet, or at minimum drop their `priority` well
   below 0.8.
3. Job-detail pages (`/jobs/[slug]`, `/internships/[slug]`,
   `/remote-jobs/[slug]`, `/government-jobs/[slug]`): add
   `robots: { index: false }` for the same is_thin-and-unenriched
   condition — same mechanism `seoMetrics.ts`'s existing
   `isStaleForIndexing()` already uses for expired listings, new
   condition.

## Phase B — Close the enrichment backlog

1. Add a genuine backfill mode to `content_enrichment.py` /
   `structured_enrichment.py`: a `bulk=True` path that queries the
   *existing* DB backlog directly (not just `index.py`'s per-run
   `enriched` list), run as a one-off script and/or a slower daily cron
   job separate from the per-crawl cap.
2. As each job gets a real AI overview, Phase A's noindex/low-priority
   flag clears automatically and it re-enters the sitemap at full
   priority — this is the mechanism that should shrink "Discovered —
   not indexed" over time instead of it only ever growing.

## Phase C — JobPosting schema completeness

`jobPostingSchema()`: fall back `datePosted` to `last_seen_at` when a
source gives no date ("when we found it" is honest and better than an
invalid schema), and fall back `jobLocation` to a country-level `Place`
when no city string exists and the job isn't remote.

## Phase D — Breadcrumbs on hub pages

PHASE_PLAN.md Phase 3 item 4. Wire the already-built `Breadcrumbs.tsx` /
`breadcrumbSchema()` into `/skills/[skill]`, `/companies/[company]`,
`/jobs-in/[city]`, and the `/jobs`/`/internships` list pages themselves.

## Phase E — Re-verify

After A–D ship and Google re-crawls (allow 2-3 weeks), re-check the same
four GSC reports. The "Discovered — not indexed" trend line flattening
or reversing is the real pass/fail signal, more than any single number.

## Phase F — Same-day priority indexing push

Phases A-E fix the *pull* side: they stop feeding Google low-value pages
and make the sitemap something worth re-crawling. But a sitemap is still
a signal Google chooses when (or whether) to act on. Phase F adds a
*push* side on top, specifically for the highest-value slice of each
day's scrape — a known/big company, a high `confidence_score`, posted
today — instead of waiting for organic re-crawl:

1. **Selection** — `services/api/scripts/phase_f_priority_index_push.py`
   selects, per run: up to `--job-cap` (default 60, keep in the 50-60
   range) non-internship jobs and up to `--internship-cap` (default 10)
   internships, scoped to `created_at::date = today` (the crawler's
   first-ever-seen timestamp — see `utils.py`'s `upsert_jobs`, which never
   overwrites `created_at` on a re-crawl), ranked by the same
   top-company/`confidence_score` signal `routes/jobs.py`'s
   `RANKING_EXPRESSION`/`TOP_COMPANY_TIER` already use, and excluding
   thin-and-unenriched listings (same rule as the sitemap's
   `isThinAndUnenriched`, Phase A above).
2. **IndexNow** — one batched POST per run to `api.indexnow.org`, fanning
   out to Bing/Yandex/Seznam/Naver. No topic restriction; reuses the same
   key already deployed for `scripts/indexnow-submit.mjs`.
3. **Google Indexing API** — one POST per URL to
   `indexing.googleapis.com`, auth'd via a service-account JWT-bearer flow
   (self-contained, no new dependency — signs with `cryptography`, calls
   out with `httpx`, both already in `requirements.txt`). **Scoped
   deliberately to job/internship detail pages only** — Google's own docs
   restrict the Indexing API to pages with `JobPosting` or
   `BroadcastEvent` structured data, which this site's detail pages
   already emit (`lib/structuredData.ts`'s `jobPostingSchema()`); this is
   why the script never touches hub pages, blog posts, or anything else.
   There is no bulk-push equivalent for Search Console itself — GSC's UI
   only has a manual, one-at-a-time "Request Indexing" button — so the
   Indexing API is the actual mechanism behind what's usually meant by
   "push to GSC" for a job board specifically.
4. **Idempotency + audit** — migration `022_priority_index_push.sql` adds
   `jobs.indexnow_submitted_at`/`jobs.google_indexing_submitted_at` (so a
   job already pushed today is never resubmitted by a later run) and a
   `priority_index_log` table (one row per submission attempt, for
   debugging and for watching Google Indexing API quota usage — default
   200 requests/day per GCP project, `GOOGLE_INDEXING_DAILY_QUOTA`
   defaults to 180 to leave headroom).
5. **Schedule** — `.github/workflows/phase-f-priority-index.yml` runs six
   times a day (SSH into EC2, same pattern as `content-enrichment.yml`)
   so listings scraped mid-day don't sit unpushed for 24h waiting on a
   once-daily cron.

**Setup required before this does anything on the Google side:** a GCP
service account with the Indexing API enabled, added as an Owner on this
site's Search Console property, with its key JSON set as
`GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` in the EC2 box's `.env`. Without
that, the script logs it and pushes to IndexNow only — not an error, just
a smaller push.

## Status

Re-audited against the actual code this session (not just this doc's
prior status lines, which had drifted from what was really implemented).

- **Phase 0: still in progress.** This is the one item that's
  inherently a manual check ("does the live site actually show X"), not
  something verifiable from a code drop. Self-check remains handed to
  the site owner (canonical tag on a live job page, one vs. two filter
  bars on `/jobs`, live `robots.txt` contents, a `/companies/[x]` hub
  page, deploy-pipeline mechanics).
- **Phase A: done, verified in code.** `routes/jobs.py`'s `JOB_COLUMNS`
  selects both `is_thin` and `quality_score`; `sitemap-jobs.xml` excludes
  thin-and-unenriched jobs entirely rather than just downranking them;
  all four detail templates (`jobs`, `internships`, `remote-jobs`,
  `government-jobs` `[slug]`) set `robots: { index: false }` for the
  same condition via the shared `isThinAndUnenriched()` /
  `isStaleForIndexing()` helpers.
- **Phase B: partially done.**
  - Overview backfill (`enriched_overview`/`enriched_keywords`):
    `scripts/enrich_job_content.py` already queries the full backlog
    directly (`is_active = true AND` thin `AND enriched_at IS NULL`,
    not scoped to a single crawl run) and runs on a schedule via
    `content-enrichment.yml`. This half was already closed before this
    session.
  - Structured-field backfill (`allowed_degrees`, `required_skills`,
    etc. — migrations/021): `scripts/enrich_all_content.py --target
    structured --bulk` existed and does the same full-backlog query
    shape, but **nothing scheduled it** — it only ran if someone SSHed
    in and triggered it by hand. **Closed this session**: added
    `.github/workflows/phase-b-structured-backfill.yml`, daily, same
    SSH-into-EC2 shape as the other scheduled jobs. See
    CHANGES_THIS_SESSION.md for the one caveat on that new file (the
    real `content-enrichment.yml`/`phase-f-priority-index.yml` weren't
    available to copy from directly — see the note at the top of the
    new workflow file).
- **Phase C: done** — `jobPostingSchema()` now falls back `datePosted`
  to `last_seen_at` and `jobLocation` to a country-level `Place`. See
  CHANGES_THIS_SESSION.md.
- **Phase D: done** — breadcrumb JSON-LD + `<Breadcrumbs>` were already
  wired into every hub/list page from earlier sessions; this session's
  actual fix was removing a duplicate hand-written `<nav>` breadcrumb
  left over on seven pages. See CHANGES_THIS_SESSION.md.
- **Phase E: not started** (correctly still pending — blocked on A/B
  fully landing plus a 2-3 week re-crawl window; not a code task).
- **Phase F: code complete, verified** — `phase_f_priority_index_push.py`,
  migration 022, and the six-times-a-day workflow all check out against
  the plan above. Still needs `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` set
  on the EC2 box before its Google Indexing API leg activates; the
  IndexNow leg works without it.

**Net effect of this session's Phase B work:** once
`phase-b-structured-backfill.yml` is confirmed against the real
scheduling pattern and merged, Phase B has no remaining code gap —
both halves of the enrichment backlog (overview and structured) now run
on an unattended schedule against the full backlog, not just each
crawl's newly-scraped rows.

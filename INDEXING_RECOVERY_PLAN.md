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

## Status

- Phase 0: in progress (self-check hand-off to site owner, not yet
  confirmed)
- Phases A–E: not started

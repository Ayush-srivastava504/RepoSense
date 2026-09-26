# Fixes applied in this pass

## 1. services/api/src/routes/jobs.py — GONE_IDS_MAX_ROWS 20000 -> 100000
You had 61,388+ inactive jobs but this endpoint only ever returned the
20,000 most-recently-deactivated (ORDER BY last_seen_at DESC LIMIT ...).
The rows falling out of that cap were your OLDEST-sitting zombie listings
-- exactly the ones stuck as "Discovered - currently not indexed" in GSC
-- so they resolved to a plain 404 instead of a 410. Raised the cap with
headroom above your current inactive count. No other file needed a change:
goneJobs.ts on the web side just consumes whatever `ids` array comes back,
and the existing tests reference the constant symbolically, not as a
literal 20000.

Action needed: deploy the API. Within one 10-minute refresh window, every
inactive job should start resolving to a real 410.

## 2. apps/web/app/layout.tsx — removed headers()/cookies() locale read
The root layout unconditionally called headers()/cookies() to set <html
lang>. For every route using generateStaticParams + dynamicParams: true
(companies/[company], skills/[skill], blog/[slug], careers/[role],
tools/[tool], tools/[tool]/vs/[competitor], jobs-in/[city], batch/[year],
resume-for/[role]), any param NOT in the pre-rendered set hit
DYNAMIC_SERVER_USAGE mid on-demand-static-render -> 500 in production.
That's what your sourcingxpress log showed. Locale coverage was already
thin (162 translated strings, 1/40 blog posts), so this cosmetic attribute
was costing far more than it was worth. <html lang> is now hardcoded to
"en"; if per-locale lang is wanted later, read it inside blog/[slug]
specifically (no static-param conflict there), not globally.

Action needed: deploy the web app. Re-check GSC / server logs for the
previously-500ing routes after a few days.

## 3. services/api/crawler/src/processors/content_layer.py — new file
Runs right after quality.py's filter_and_score(), before the DB write.
Gates content depth (full LLM overview+FAQ+chart / templated
standard / table_only-no-FAQ) on the legitimacy_state and is_thin flags
quality.py already computes, so LLM spend tracks confidence rather than
raw crawl volume, and low-confidence jobs never get a confident-sounding
FAQ. FAQ answer *facts* are slot-filled deterministically from job
fields -- an LLM call (if used) only rewrites phrasing, it can't invent
the underlying facts. Not yet wired into the pipeline call site (crawler
main entry point after filter_and_score()) -- call
content_layer.attach_content_plan(job) on each item in `kept` when
you're ready to turn this on.

## Not included (flagged, not guessed)
- indexnow-submit-gone.mjs: needs either a new DB-connecting script
  pattern or a new backend endpoint returning slugs (not just ids) for
  the gone set. Existing indexnow-submit.mjs only reads the live
  sitemap, so it will NOT submit the newly-410'd URLs to IndexNow as-is
  -- it's still worth running for your current live catalog, just not
  for that purpose.
- Government-jobs vertical: still blocked on a product decision.
  ENABLED_SCRAPERS excludes freejobalert/employment_news on purpose, and
  quality.py/relevance.py hard-reject .gov.in domains and non-tech
  titles by design. Needs a parallel relevance/quality path, not a
  config flag.
- Queue-based ingestion/generation pipeline and segment_stats.py
  (nightly chart aggregation): sketched in conversation, not yet built.

## 4. indexnow-submit-gone.mjs — now built (was flagged as missing last pass)
Needed a way to get gone jobs' URL-building fields without giving a
standalone node script its own DB connection. Built as:

- **services/api/database/migrations/025_deactivated_at.sql** — new
  `deactivated_at` column, set by a DB TRIGGER (not app code) on any
  UPDATE that flips `is_active` true->false, so it's correct regardless
  of which code path does it -- including manual SQL like the prune run
  earlier. Backfills existing inactive rows from `last_seen_at` as an
  approximation. Also adds a partial index for the new query pattern.
  **Run this migration before deploying the API changes below.**
- **services/api/src/routes/jobs.py** — new `GET /gone-urls` endpoint,
  returns title/company/location/salary/stipend/type/is_remote/
  is_government for recently-deactivated jobs (default: last 1 day),
  filtered/ordered by the new `deactivated_at`. Also switched the
  existing `/gone-ids` from `last_seen_at` to `deactivated_at` for the
  same reason -- last_seen_at is when the crawler last saw a job ACTIVE,
  not when it went inactive, so both endpoints were silently
  prioritizing/windowing the wrong rows.
- **services/api/tests/test_gone_ids.py** — updated 2 assertions that
  checked for the literal (now-replaced) `last_seen_at` column name.
- **services/api/tests/test_gone_urls.py** — new, covers the new
  endpoint. All 10 tests across both files pass (`pytest
  tests/test_gone_ids.py tests/test_gone_urls.py`).
- **scripts/indexnow-submit-gone.mjs** — new script. Fetches
  `/api/jobs/gone-urls`, rebuilds each canonical URL with slug logic
  ported from `lib/slug.ts` (verified byte-for-byte against the real
  jobSlug() output), submits to IndexNow. Run right after a deactivation
  pass:
  `node scripts/indexnow-submit-gone.mjs --dry-run` then
  `node scripts/indexnow-submit-gone.mjs`
  For a one-off backlog catch-up (e.g. covering the 28,534 already
  deactivated), pass a wider window:
  `node scripts/indexnow-submit-gone.mjs --since-days=30`
  (30 is the current hard max on the API; today's specific batch won't
  have an exact deactivated_at since it predates migration 025 -- it'll
  fall back to the last_seen_at-backfilled approximation, so some of
  that batch may not land in a 30-day window depending on when it was
  last crawled. Going forward, every newly-deactivated job gets an exact
  timestamp via the trigger.)

## Still not included
- Government-jobs vertical: still blocked on a product decision (see
  above -- ENABLED_SCRAPERS and quality.py/relevance.py hard-exclude it
  by design, not by accident).
- Queue-based ingestion/generation pipeline and segment_stats.py
  (nightly chart aggregation): sketched in conversation, not yet built.

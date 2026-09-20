# Repo audit — 2026-09-20 (follow-up to Stage 3 sitemaps)

Findings from reading the whole repo against the "Discovered – currently not indexed"
problem (15,368 URLs). **Applied** = changed in this drop and covered by tests
(`npm run test:sitemap`, `pytest services/api/tests`). **Needs a decision** = not changed.

## Applied

1. **API errors were turning valid job pages into real 404s.** `getJobById()` returned
   `null` for *any* non-OK response, and the pages call `notFound()` on null. A 429 (the API
   allows 50 req/min per IP) or a 5xx therefore served Googlebot a 404 for a healthy job.
   Now only a genuine 404 is "not found"; 429/5xx/timeouts throw (a 5xx that crawlers retry;
   ISR keeps serving the last good page). The OG-image route still degrades to the generic card.
2. **SSR traffic shares one anonymous rate-limit bucket.** Vercel renders pages from shared
   egress IPs, so all SSR/ISR/sitemap calls counted against one `ip:` bucket (50/min).
   Added an opt-in `X-Internal-Key` exemption. **Inert until you set `INTERNAL_API_KEY`**
   to the same random value on the API host and in Vercel (server env, *not* `NEXT_PUBLIC_`).
3. **`Disallow: /*?*page=` in robots.txt** hid pages 2..N of every list, i.e. the only crawlable
   path to most job pages (12 jobs per page). Removed; `?page=N` is now self-canonical with a
   distinct title (`lib/seo/pagination.ts`). Every `?page=N` used to canonicalise to page 1.
   Search/loc/sort permutations stay blocked. To revert, re-add the one Disallow line.
4. **`Disallow: /_next/`** blocked the JS/CSS Googlebot needs to render pages. Removed.
5. **Job cards linked to redirects.** `JobCard` used a hardcoded `basePath`, so an internship
   listed on `/jobs` linked to `/jobs/{slug}`, which 308-redirects to `/internships/{slug}`
   (same on remote/government/hub pages). It now always links to `canonicalPathForJob(job)`;
   the `ItemList` schema URLs on seven list pages use it too.
6. **Five tool pages canonicalised to the homepage.** `/ats-checker`, `/cover-letter`,
   `/github`, `/linkedin`, `/resume/builder` are client components with no metadata, so they
   inherited the root layout's canonical (`/`) and homepage title. Added a `layout.tsx` with
   its own title, description and canonical for each.
7. **hreflang on job pages removed.** Job content is English-only and `/es/jobs/...` etc.
   canonicalise to the English URL, so the nine-locale hreflang cluster was invalid and
   advertised ~8 extra crawlable URLs per job.
8. **`baseSalary` was often wrong.** Every job was labelled INR and only the first number was
   read: `USD 50000-80000` → 50000 INR, `8 LPA` → 8 INR/year. New `salaryToBaseSalary()`
   detects currency, applies lakh/k multipliers, emits min/max ranges and omits the field when
   currency or pay period can't be determined.
9. `phase-b-structured-backfill.yml` gets the same 20-minute command timeout as
   `content-enrichment.yml` (the 10-minute default would kill a 300-row run).

## Needs a decision / verification (not changed)

- **Enrichment throughput vs. the Stage 3 sitemap.** The sitemap now requires
  `enriched_overview`. `content-enrichment.yml` runs 100 rows/day and the structured backfill
  300/day against a backlog of ~10k, so the sitemap may be small for a while. Check the
  `sitemap-jobs: … jobs=N internships=N …` log line after deploy; raise the scheduled `limit`
  (mind Groq limits) if you want the sitemap to grow faster.
- **Monetisation scripts.** `nap5k.com` push tag on the four list pages, a `n6wxm.com` vignette
  (full-screen interstitial) on internship detail pages, and `public/sw.js` importing
  `3nbf4.com`'s push service worker. Interstitials and push-ad scripts are a plausible
  page-experience/quality drag and worth testing off for a few weeks. Also check Search Console
  → Security issues and Manual actions. Revenue trade-off is yours.
- **Middleware 410 check** still makes one API call per job-page request (1.5s timeout, per-instance
  cache). With the internal key it no longer trips the rate limit, but it still adds latency; a
  cached "recently expired IDs" list from the API would remove it.
- **`datePosted` fallback uses `last_seen_at`**, which moves on every crawl (the comment calls it
  "first seen"). `created_at` is the honest fallback, but it isn't in `JOB_COLUMNS`; confirm the
  column exists in production before adding it (the crawler code has an `UndefinedColumn` fallback,
  so some deployments may lack it).
- **`addressCountry` values** come straight from `job.country`; one scraper stores the *location*
  there and the remote feeds use `'Europe'`, neither of which is a valid country.
- **Locale URLs** (`/es/...`) render the same English job content with translated chrome and
  canonicalise to English. If they aren't meant to rank, consider noindex on locale-prefixed job pages.
- `<html lang="en">` is hard-coded for every locale.

## Session 2 (this drop) — implemented from IMPLEMENTATION_PLAN.md

Company enrichment wiring (plan §3) and `addressCountry`/locale-content work
were explicitly deferred/skipped this round — everything else is done and
tested (`npm run test:sitemap`: 41/41; `pytest services/api/tests`: 35/35;
`tsc --noEmit`: clean).

1. **Sitemap priority is now tiered**, not a single 14-day cutoff
   (`lib/sitemapJobs.ts`, `isJobForSitemap`): 0-30d always included once
   enriched; 31-90d needs `quality_score >= 50`; 90d+ needs `>= 75`. The
   50/75 thresholds are a placeholder — check `quality_score`'s real
   min/max/avg in production and adjust if the distribution doesn't support
   them.
2. **Fixed a real "no ORDER BY" bug** in `enrich_all_content.py`'s default
   structured-backfill query (the path `phase-b-structured-backfill.yml`
   actually runs daily) — it now orders `posted_at DESC NULLS LAST` like
   every other enrichment query already did.
3. **`created_at` is now usable end-to-end** for `datePosted`/`lastmod`:
   added to `JOB_COLUMNS` (jobs.py), the `Job`/`SitemapJob` TS types, and the
   fallback chains in `structuredData.ts` and `sitemapJobs.ts`
   (`posted_at || created_at || last_seen_at`, last_seen_at still never used
   for `lastmod`). **Confirm the column exists in production before
   deploying** (`migrations/016_fix_jobs_created_at.sql` adds it
   idempotently, but this repo can't verify it ran there).
4. **New `GET /api/jobs/gone-ids?since_days=`** endpoint (bounded, ordered by
   `last_seen_at`) plus a rewritten `lib/goneJobs.ts`: the 410 check now
   refreshes one shared "recently gone" Set every 10 minutes instead of
   caching per job ID — the old per-ID cache didn't amortize across Vercel's
   ephemeral instances the way a shared list does. Same fail-open contract.
5. **`<html lang="en">` is now dynamic** (`app/layout.tsx`), using the same
   `x-locale` header / `NEXT_LOCALE` cookie pattern the blog pages already
   used. Also fixed `middleware.ts` to set `x-locale` on the *request*
   headers (via `NextResponse.rewrite(url, { request: { headers } })`), not
   just the response — the response-only header it set before wasn't
   actually visible to Server Components' `headers()` call on the same
   request, only round-tripped via the cookie on a later visit.

### Still open (see IMPLEMENTATION_PLAN.md for the full design)
- `addressCountry` normalization — blocked on `SELECT country, count(*) FROM
  jobs GROUP BY country ORDER BY 2 DESC` from production; can't build a
  correct city/region→country map from the repo alone.
- Genuine per-locale job content (`job_translations` table, locale-aware
  hreflang, translated rendering) — largest remaining item, deliberately last.


## Session 3 — job-enrichment replacement + fact-based company profiles

(Sessions 1-2 above refer to `content-enrichment.yml`; that workflow is removed as of this session.)

### Job enrichment
`content-enrichment.yml` ran `scripts/enrich_job_content.py`, which stores the template
fallback whenever Groq is unavailable, and marks the row enriched so it is never revisited.
Because the sitemap requires `enriched_overview`, template text was getting jobs into it.

1. **Removed** `.github/workflows/content-enrichment.yml`. `enrich_job_content.py` is left in
   place but marked as unscheduled (delete it if you don't want it around).
2. **Added** `.github/workflows/job-content-enrichment.yml` (04:00 UTC, limit 100, 30-minute runtime
   budget, 45m command timeout) running `enrich_all_content.py --target jobs --redo-fallback --no-fallback`
   inside the running `api` container (`exec`, like phase-b).
3. **`--no-fallback`**: Groq-written overviews only. Exits **2** before touching the DB if
   `GROQ_API_KEY` isn't visible in the container, so a missing key turns the workflow red instead
   of quietly writing template text. A row Groq can't handle is left untouched and retried.
4. **`--redo-fallback`**: also selects rows with `enriched_model = 'template-fallback'`
   (newest first), so what the old workflow wrote gets replaced.
5. Each run now logs `ai=N, fallback=N`.

### Follow-up fixes (timeouts, fallbacks, stale comments)
1. **Phase-b timeout.** 300 rows x the 20s default delay is ~100 minutes against a 20-minute
   `command_timeout`, and Groq 429 backoff (up to 6 retries, <=90s each) can add minutes per row.
   `enrich_all_content.py` now has `--max-runtime-minutes`: it stops *starting* rows once the budget
   is spent (checked between rows), so `--limit` is only an upper bound and the run ends cleanly.
   `phase-b-structured-backfill.yml`: 25-minute budget, 40m `command_timeout`, `max_minutes` and
   `delay` dispatch inputs (blank `delay` = keep whatever the api container is configured with, so an
   `ENRICH_REQUEST_DELAY_S` in the box's `.env` isn't overridden). `job-content-enrichment.yml` got the
   same treatment. Expect roughly budget / (delay + ~3s) rows per night; every run logs its elapsed
   time and counts. If you want more rows per night, lower the delay (mind Groq's limits) or raise the
   budget and move the 04:00 job slot.
2. **Structured backfill fallback.** `--no-fallback` now covers `--target structured` too, and
   phase-b runs with it: no rule-based fields are written when Groq fails or the key is missing. Two
   extra guards: exit **2** if the key is missing; exit **3** if a target attempted rows but enriched
   none (Groq outage, or the same rows failing at the head of the queue every night) so the run goes
   red instead of looking healthy.
3. **A real overwrite bug in bulk mode** (fixed for all runs, flag or not): once the unstructured
   backlog is exhausted, `--target structured --bulk` re-selects rows that already have a Groq-written
   `structured_description`. If Groq failed for one, the rule-based fallback used to overwrite the good
   fields and set `structured_description` back to NULL. Fallback results now only update rows where
   `structured_description IS NULL` (verified on Postgres: the Groq row was untouched, an unstructured
   row still got the rule-based fields), and such no-op rows are not counted as enriched.
4. **Stale comments** pointing at the deleted `content-enrichment.yml` fixed in
   `phase-b-structured-backfill.yml` (its old "authored without seeing the other workflows" note is
   gone too) and `phase-f-priority-index.yml`; the plan's reference updated.

### Company profiles (fact-only; supersedes the first Session 3 draft, which used Groq)
The Groq version guessed "what kind of company this is" and wrote culture/review-style text
from a name and job titles. It is deleted (`company_enrichment_service.py`).

1. **`services/company_facts_service.py`** builds a fact sheet from the company's own jobs and
   renders it. Every number/name is an aggregate; a sentence is only written if its data exists.
   Deterministic, no LLM, no per-row delay - a run covers every company in seconds.
2. **`enrich_all_content.py --target companies`** aggregates in batched SQL using
   `routes.jobs._freshness_conditions()` (the same window `/companies` counts with, so the
   profile agrees with the job list). Companies match case-insensitively. Rows refresh nightly
   (20h staleness) because listings turn over fast; the overview says "As of <date>".
3. **Migration `023_company_profile_facts.sql`** adds `company_profiles.facts JSONB`.
   `culture_summary` / `review_snippets` are no longer written (set NULL on refresh).
4. **Thin companies** (fewer than 2 substantive fact types among locations, work mode, role
   families, skills, eligibility, pay) get a row with `overview` NULL, so they are not
   re-examined every night and no stub text is produced.
5. **`GET /api/companies/{company}/profile`** now returns `overview, keywords, facts, model,
   enriched_at` (no culture/review fields) and 404s when there is no overview.
6. **`.github/workflows/company-enrichment.yml`** - nightly 02:00 UTC, limit 5000, no Groq.

### Testing
`PYTHONPATH=src pytest tests` from `services/api`: **71/71**. Candidate, facts and upsert SQL,
and the `--redo-fallback` selection, were also run against a real Postgres 16 with migrations
019 + 023 (case-variant merge, an old speculative row replaced, stale/inactive/blank companies
skipped, thin company stored without overview, idempotent second run).

### Not yet user-visible
`apps/web/app/companies/[company]/page.tsx` still doesn't call the profile endpoint, so these
rows reach no page until it renders them.

### Still open (see IMPLEMENTATION_PLAN.md for the full design)
- `addressCountry` normalization - blocked on `SELECT country, count(*) FROM jobs GROUP BY
  country ORDER BY 2 DESC` from production.
- Genuine per-locale job content (`job_translations`, locale-aware hreflang) - largest remaining
  item; needs the locale list decided first.

## Session 4 - leftovers closed

- **`addressCountry` / `applicantLocationRequirements`** now go through `lib/country.ts`
  (`normalizeCountryCode`): names and codes become ISO-2, a country at the end of a location
  string is picked up, and `Europe` / `Worldwide` / bare city strings resolve to nothing, so the
  field is omitted instead of emitting an invalid country. A blank column keeps the old `IN`
  default. Applies to JobPosting and Event schema. Tests: `apps/web/tests/country.test.ts`.
  Scraper-side cleanup (stop writing a location into `country`) is still worth doing, but the
  page output is no longer wrong while it waits.
- **Locale-prefixed job detail pages** (`/es/jobs/<slug>` ... 8 locales x 4 categories) are now
  `Disallow`ed in `public/robots.txt` rather than noindexed: they duplicate the English page,
  canonicalise to it and are in no sitemap, so the goal is to stop spending crawl budget on them.
  The trailing slash keeps the translated list pages (`/es/jobs`, hreflang targets) crawlable.
- **hreflang on job pages stays removed** - correct while job content is English-only. Locale-aware
  job hreflang only makes sense with real per-locale content (`job_translations`), still open.
- Already done in the drop this session started from: dynamic `<html lang>`, `lib/goneJobs.ts`
  on the shared `/gone-ids` set.
- Removed `scripts/enrich_job_content.py` (unscheduled since `content-enrichment.yml` was
  deleted; nothing imported it) and the stale comments pointing at it.

## Session 5 - hreflang switched off site-wide

`sitemap-static.xml` (and `sitemap-blog.xml`, and the page-level `<link rel="alternate">` tags on
~25 pages) advertised `/es/...`, `/fr/...` etc. as hreflang alternates, but every page declares its
canonical as the English URL and only 162 UI strings are translated (1 of 40 blog posts has a
translation per locale). Canonical said "duplicate of English", hreflang said "the Spanish
version" - contradictory, so Google ignores it, and it advertised ~9 URLs per page.

All emitters now go through `lib/hreflang.ts` (`HREFLANG_ENABLED = false`). With it off the
sitemaps are plain `<urlset>` files (no `xmlns:xhtml`), which also makes Chrome show the normal
XML tree instead of a wall of text. To bring hreflang back: ship real translated content AND make
each locale page self-canonical, then flip the flag. Tests: `apps/web/tests/hreflang.test.ts`.

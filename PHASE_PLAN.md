# RepoSense — FresherFlow-Parity Roadmap

Three-phase plan to bring RepoSense's job feed up to parity with
FresherFlow on filtering UX, SEO/thin-content, and scraper coverage.
**Phase 1 is complete and included in this build.** Phase 2 and 3 are
scoped below so the next session can pick either up without
re-discovering the codebase from scratch.

See also **INDEXING_RECOVERY_PLAN.md** — a separate, GSC-driven plan
(Sep 2026) for why most of the site's pages aren't being crawled/indexed.
Independent of Phase 3 below, though Phase 3 item 4 (breadcrumbs on hub
pages) is also that plan's Phase D.

---

## Phase 1 — COMPLETE (this build)

### Filters (FresherFlow-style dropdown filter bar)
- `apps/web/lib/facets.ts` — computes live "(N)" counts for
  Skills / Course / Source / Batch / Company from the fetched job set.
- `apps/web/lib/filterJobs.ts` — multi-select filter parsing (comma-
  separated query params) and client/server-side application.
- `apps/web/app/components/AdvancedJobFilters.tsx` — the dropdown-popover
  filter bar itself: Location, Role, Skills, Course, Source, Batch,
  Company. Skills/Source/Company have an in-panel search box, matching
  FresherFlow's `internships` page screenshots. Renders below the
  existing quick chip filters (`JobFilters.tsx`), which are unchanged.
- Wired into both `/jobs` and `/internships` list pages, including
  pagination (filters survive page-to-page navigation) and a live
  "N found" count next to the page `<h1>`.
- `apps/web/app/components/JobTags.tsx` — dense per-card chip row (work
  mode, education, source ATS, individual skills), matching FresherFlow's
  job card density from the screenshots. Wired into `JobCard.tsx`.

### Thin content
- `apps/web/app/components/ExploreRelated.tsx` — "Explore Related
  Placements" chip-link row on every job detail page: company careers
  hub, city hub (`/jobs-in/[city]`, matched from the job's raw location
  string), up to two skill hubs (`/skills/[slug]`), and a role search
  link. Only renders links that genuinely match — never a fabricated
  link — and only renders the section at all if at least one link
  exists. Wired into `JobDetail.tsx`, so it appears on every job/
  internship/remote-job/government-job detail page (they all share this
  component).
- `StructuredDetails.tsx` (Education / Key Skills / Notes / Experience
  panel) was already present and already close to FresherFlow's
  structured-details panel — left as-is.

### SEO
- `apps/web/lib/seo/seoMetrics.ts` — ports FresherFlow's pixel-width
  `<title>` truncation (`opportunitySeo.ts`) instead of a raw character
  cutoff, plus word-boundary meta-description truncation and a shared
  `buildJobTitle()` / `isStaleForIndexing()`.
- Applied to **all four** job-detail routes (`jobs/[slug]`,
  `internships/[slug]`, `remote-jobs/[slug]`, `government-jobs/[slug]`):
  rich pixel-truncated titles, truncated descriptions, and `noindex` once
  a job is past its deadline (or 45 days past `posted_at` with no
  deadline) — mirrors FresherFlow's expiry-grace-period `noindex`.
- `lib/structuredData.ts` `jobPostingSchema()` now emits `skills`,
  `educationRequirements`, and `experienceRequirements` from the
  structured-enrichment fields, not just the fields it already had.
- `public/robots.txt` — added explicit `Disallow: /` blocks for
  GPTBot, ChatGPT-User, CCBot, Google-Extended, Applebot-Extended,
  Bytespider, ClaudeBot, anthropic-ai, cohere-ai, PerplexityBot, scoped
  to their own `User-agent` blocks so they never fall through to the
  permissive `User-agent: *` rules. Normal search engine crawlers are
  untouched.
- `middleware.ts` — adds an `X-Robots-Tag: noindex, nofollow` response
  header for `/dashboard` (defense-in-depth alongside the existing
  robots.txt `Disallow`, matching FresherFlow's `applySeoHeaders`).
  Deliberately scoped to `/dashboard` only, not the whole `(auth)` route
  group — see the Phase 2 note below on why.

### Scrapers
New ATS adapters, all following the existing `ats_common.py` pattern
(public/unauthenticated JSON or XML, no login, dedupe + retry/backoff
already shared):
- `scrapers/recruitee.py` — `{company}.recruitee.com/api/offers/`
- `scrapers/teamtailor.py` — `{company}.teamtailor.com/jobs.json`
- `scrapers/bamboohr.py` — `{company}.bamboohr.com/careers/list`
- `scrapers/breezyhr.py` — `{company}.breezy.hr/json`
- `scrapers/personio.py` — `{company}.jobs.personio.de/xml` (XML feed —
  the one provider here that isn't JSON; parsed with stdlib
  `xml.etree.ElementTree`, no new dependency)
- `scrapers/freshteam.py` — `{company}.freshteam.com/api/career_site/jobs`

New board adapter (own search index, not per-company boards — same
category as `linkedin.py`/`weworkremotely.py`):
- `scrapers/naukri.py` — parses Naukri's server-rendered `__NEXT_DATA__`
  JSON island first, falls back to CSS-selector scraping of visible cards
  if that blob isn't present.

New discovery scraper — the single highest-leverage addition:
- `scrapers/dorker.py` — ports FresherFlow's `dork-executor.ts` /
  `dorker.ts` approach. Runs Bing-dork queries
  (`site:boards.greenhouse.io "intern" India`, etc.) against Greenhouse/
  Lever/Ashby/SmartRecruiters/Workable board URL patterns, extracts
  never-before-seen company tokens, and fetches jobs from those boards
  directly — closing the exact gap `config.py`'s own comment flagged
  ("the real fix ... is dynamic board discovery via search rather than a
  static company list"). Jobs from this path are tagged
  `source='dorker'` (shown as "Web Discovery" in the new Source filter)
  so they're distinguishable from the hand-maintained per-provider lists,
  which remain in place as the reliable baseline — dorker is additive,
  not a replacement.

All new scrapers are registered in `config.py` (`ENABLED_SCRAPERS`,
`ATS_COMPANIES` example token lists — same "not live-verified, best-
effort" caveat the existing ashby/smartrecruiters lists already carry)
and `index.py`'s `_load_scrapers()` registry.

---

## Phase 2 — Scale & correctness

1. **Backend facets endpoint — DONE.** Added `GET /api/jobs/facets`
   (`services/api/src/routes/jobs.py`) — runs `GROUP BY`/`unnest()`
   aggregation server-side against the full `jobs` table (scoped by
   search/type/category/job_group/country/work_mode, deliberately not
   by the advanced filters themselves, so each dropdown's own count
   list doesn't shrink to just its selected value). Response shape
   matches `FacetSnapshot` exactly. `apps/web/lib/facets.ts` now
   exposes `getJobFacets()` as the call site both `/jobs` and
   `/internships` list pages use; `buildFacetCounts()` (the old
   fetched-page-bounded computation) is kept only as a fallback/testing
   utility, no longer called from either page. Covered by
   `services/api/tests/test_jobs_facets.py` (9 tests, mocked DB pool —
   asserts SQL/params shape and response shape, not live query
   results).
2. **Push multi-select filters server-side — DONE.** `routes/jobs.py`'s
   `GET /api/jobs/` now accepts comma-separated `skills=`, `courses=`,
   `sources=`, `batches=`, `companies=` (slugs from the facets
   endpoint) and applies them as SQL `WHERE`/`unnest()` conditions,
   ANDed together, each an OR-of-selections — matches the old
   `filterJobs.ts` `applyAdvancedFilters()` semantics but runs in
   Postgres against the full table instead of a fetched, `limit`-bounded
   page. `apps/web/lib/jobs.ts`'s `getJobs()` passes
   `advancedFilters.{skills,courses,sources,batches,companies}` straight
   through as these params from both list pages.
   **Pagination follow-up — DONE.** `/jobs` and `/internships` now send a
   page-sized `limit`/`offset` per request and read the response's `total`
   field, via a new `getJobsPage()` (`apps/web/lib/jobs.ts`) that returns
   `{ jobs, total }` instead of just an array — `getJobs()` itself is
   unchanged (still used by every hub/sitemap page that only wants the
   array). The one real correctness gap this uncovered: the "India"
   location filter and the "India first" ordering on `loc=all` were
   computed client-side (`lib/jobPriority.ts`'s `isIndiaJob()`/
   `sortIndiaFirst()`) over the *entire* fetched array — impossible to
   replicate correctly against a single already-paged, already-ordered
   12-row response. Ported both into SQL in `routes/jobs.py` as new
   `india_only`/`india_first` query params (`_INDIA_ONLY_CONDITION`/
   `_INDIA_BUCKET_SQL`, mirroring `bucket()`'s exact null/blank/"india"
   → remote → "japan" → other precedence) so the DB does the filtering
   and ordering before `LIMIT`/`OFFSET` is applied, rather than after.
   `isIndiaJob`/`sortIndiaFirst` are kept and still used for the small,
   unpaginated featured-jobs list on both pages.
   Handles the requestedPage-past-the-end case (a stale `?page=` link)
   by clamping to the real last page and refetching only when that
   happens — the common case is still a single request.
3. **More ATS providers**, matching FresherFlow's full list: Workday
   (CXS API), iCIMS, SuccessFactors, Zoho Recruit, Keka, Darwinbox,
   Eightfold, Comeet, Hibob, Zwayam — several of these need more
   involved auth/session handling than the simple public-JSON pattern
   the Phase 1 providers used, hence deferred.
4. **More board scrapers**: Wellfound, Bayt, Glassdoor, HackerNews
   "Who's Hiring" threads — same board category as `naukri.py` but each
   with its own markup quirks worth handling individually rather than
   batching in with less scrutiny.
5. **Direct company career-page scrapers**: Google, Amazon, Microsoft,
   Apple, Uber, Meta, Nvidia — `company_portals.py` already has the
   pattern (see `tech_mahindra`/`tcs`/`infosys`/`wipro` entries in
   `config.py`'s `COMPANY_PORTALS`); extend that dict rather than writing
   new scraper classes.
6. **Liveness/legitimacy verifier for dorker-discovered boards** — before
   a `dorker`-sourced board's jobs get treated as fully trusted, run them
   through the same quality gate (`processors/quality.py`) with a
   slightly higher bar than hand-curated `ATS_COMPANIES` entries, since
   discovery has no human review step.
7. **`X-Robots-Tag` audit for the rest of `(auth)` — DONE.** Decided
   per-route in `middleware.ts`'s `NOINDEX_PREFIXES`:
   - `/login`, `/register` — now noindexed (added to `NOINDEX_PREFIXES`
     and to `robots.txt`'s `Disallow` block). Pure auth-flow pages, no
     unique content. Also removed from `sitemap-static.xml` — a sitemap
     entry for a noindexed URL is a conflicting signal.
   - `/resume(/builder)`, `/ats-checker`, `/cover-letter`, `/github`,
     `/linkedin` — left indexable. `AuthGuard` admits guests via
     `ensureGuestSession()` with no real login required, and all five
     were deliberately added to `sitemap-static.xml` in the Aug SEO pass
     as tool landing pages.
   - `/leetcode(/[slug])` — left indexable. Server components with their
     own `generateMetadata`/canonical/JSON-LD, built to be crawled.

## Phase 3 — Programmatic SEO expansion

1. **Batch/passout-year hub pages** (`/batch/2026`, `/batch/2027`, ...),
   mirroring the existing `/skills/[slug]` and `/jobs-in/[city]` hub
   pattern, backed by a new `sitemap-batches.xml` entry.
2. **Minimum-listing thresholds for hub pages**, matching FresherFlow's
   `SKILL_MIN_JOBS`/`LOCATION_MIN_JOBS` gating in `staticFeed.service.ts`
   — audit `/skills/[slug]` and `/jobs-in/[city]` to confirm they already
   404/noindex below some floor, and add the same gate to the new batch
   hub pages from item 1.
3. **Pre-generated OG images** per job (`/og/{id}.png`), cached rather
   than rendered per-crawl-hit, matching FresherFlow's approach —
   currently RepoSense likely falls back to a single static
   `og-image.png` for every job page.
4. **BreadcrumbList on every hub page**, not just job-detail pages
   (`Breadcrumbs.tsx` + `breadcrumbSchema()` already exist — this is
   wiring, not new infrastructure).
5. **hreflang audit for the new filter query params** — confirm
   `languageAlternates()` entries for `/jobs` and `/internships` don't
   break when `?skills=...&batch=...` are present (they shouldn't, since
   `alternates.languages` is keyed off the canonical path, not the full
   query string, but worth a explicit check once Phase 2's server-side
   filtering changes the canonical query shape).

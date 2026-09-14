# RepoSense — FresherFlow-Parity Roadmap

Three-phase plan to bring RepoSense's job feed up to parity with
FresherFlow on filtering UX, SEO/thin-content, and scraper coverage.
**Phase 1 is complete and included in this build.** Phase 2 and 3 are
scoped below so the next session can pick either up without
re-discovering the codebase from scratch.

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

## Phase 2 — Scale & correctness (not yet built)

1. **Backend facets endpoint.** `lib/facets.ts` currently computes
   counts from the already-fetched job page (bounded by `getJobs()`'s
   `limit`), which is correct today but won't scale once the catalog
   grows past that limit. Add `GET /api/jobs/facets` that runs the
   equivalent `GROUP BY`/`unnest()` aggregation server-side against the
   full table, and swap the call site — `FacetSnapshot`'s shape can stay
   identical so `AdvancedJobFilters.tsx` doesn't need to change.
2. **Push multi-select filters server-side.** Skills/Course/Source/
   Batch/Company are currently applied in the Next.js layer
   (`filterJobs.ts`) over the fetched page. Once the facets endpoint
   exists, extend `routes/jobs.py` to accept comma-separated
   `skills=`, `source=`, `batch=`, `company=` and do the filtering (and
   pagination) in SQL instead.
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
7. **`X-Robots-Tag` audit for the rest of `(auth)`.** Phase 1 scoped the
   noindex header to `/dashboard` only, since `/resume`, `/ats-checker`,
   `/cover-letter`, `/github`, `/linkedin`, `/leetcode` might be intended
   as public, indexable tool landing pages gated behind login only for
   *use* — that's a product call, not something to default silently.
   Decide per-route and extend `NOINDEX_PREFIXES` in `middleware.ts`.

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

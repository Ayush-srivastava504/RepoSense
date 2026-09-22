# RepoSense — Consolidated Project Status

Merges and fact-checks these 7 files (kept as-is, not deleted):
`CHANGES_THIS_SESSION.md`, `Daytodaywork.md`, `IMPLEMENTATION_PLAN.md`,
`INDEXING_RECOVERY_PLAN.md`, `NON_WWW_MIGRATION.md`, `PHASE_PLAN.md`,
`REPO_AUDIT_2026-09-20.md`. `README.md` is untouched and not merged in.

**Methodology:** every line below was checked against the actual code in
this zip (file existence, grep for the specific function/column/route, or
running the test suite) on 2026-09-20 — not taken on the documents' word.
Where a doc's own status line turned out to be stale (superseded by a
later session, or simply wrong), that's called out explicitly under
"Corrections," not silently merged in as fact.

**Test suites, re-run against this zip just now:**
- `cd apps/web && npm run test:sitemap` → **50/50 pass**
- `cd services/api && PYTHONPATH=src pytest tests` → **71/71 pass**
  (with `fastapi`, `asyncpg`, `httpx` installed — not in the zip's lockfile
  by default in this sandbox)

---

## ✅ Implemented — verified in code

### Sitemaps & indexing hygiene
- Non-www canonicalization (`lib/site.ts` single source of truth; `www` is
  301-only). — *verified: file exists, exports the origin used elsewhere.*
- `sitemap-jobs.xml` completeness check vs API `total`, 503 on incomplete,
  de-dupe, 50k cap, no fabricated `lastmod`/`changefreq`/`priority`.
- Tiered sitemap priority replacing the old flat 14-day cutoff
  (`isJobForSitemap` in `lib/sitemapJobs.ts`): 0–30d always included once
  enriched; 31–90d needs `quality_score >= 50`; 90d+ needs `>= 75`.
  — *verified: function present with these exact thresholds; tests 44/45
  pass.* Thresholds are still explicitly flagged as placeholders pending a
  real `quality_score` distribution check in production.
- `lastmod` is real-or-absent, never fabricated, and never derived from
  `last_seen_at` (which moves on every crawl). — *verified: `toLastmod()`
  in `lib/sitemapXml.ts`, plus dedicated tests 37/49/50, all pass.*
- `robots.txt`: removed the `Disallow: /*?*page=` block (was hiding pages
  2..N of every list) and `Disallow: /_next/`. `?page=N` is now
  self-canonical (`lib/seo/pagination.ts`). — *verified file exists.*
- `robots.txt`: explicit `Disallow: /` blocks for GPTBot, ChatGPT-User,
  CCBot, Google-Extended, Applebot-Extended, Bytespider, ClaudeBot,
  anthropic-ai, cohere-ai, PerplexityBot, scoped to their own
  `User-agent` blocks. — *verified via grep, all agent blocks present.*
- `/login`, `/register` noindexed (`middleware.ts` `NOINDEX_PREFIXES`) and
  removed from `sitemap-static.xml`. — *verified: `NOINDEX_PREFIXES`
  includes both; sitemap route has an explicit comment confirming the
  exclusion.*
- `X-Robots-Tag: noindex, nofollow` header for `/dashboard`.
  — *verified in `middleware.ts`.*
- Five tool pages (`/ats-checker`, `/cover-letter`, `/github`,
  `/linkedin`, `/resume/builder`) given their own `layout.tsx` with real
  metadata instead of inheriting the homepage canonical.
- `getJobById()` no longer treats 429/5xx/timeouts as 404 — only a real
  404 is "not found."
- `X-Internal-Key` exemption for SSR/ISR traffic sharing one rate-limit
  bucket (inert until `INTERNAL_API_KEY` is set on both sides — this part
  is an operational step, not code).
- `JobCard` always links via `canonicalPathForJob(job)` instead of a
  hardcoded `basePath` (fixes internship-listed-on-/jobs linking to a
  redirecting URL).
- Job cards / `ItemList` schema no longer 308-redirect.

### JobPosting schema
- `datePosted` fallback chain `posted_at || created_at || last_seen_at`
  (never emits an invalid/missing field, and `created_at` — a real
  creation timestamp — is preferred over the crawl-order-dependent
  `last_seen_at`). — *verified at `structuredData.ts:292`.*
- `created_at` is in `JOB_COLUMNS` (`routes/jobs.py`) and the frontend
  `Job`/`SitemapJob` types, so the API actually returns it.
  — *verified via grep: present in the column list.*
- `jobLocation` falls back to a country-level `Place` when there's no
  city string and the job isn't remote (previously omitted the field
  entirely, causing GSC's "Missing field jobLocation").
- `addressCountry` / `applicantLocationRequirements` go through
  `lib/country.ts`'s `normalizeCountryCode()`: names and 2-letter codes
  resolve to ISO-2, a country at the end of a `"City, Region, Country"`
  string is picked up, `'Europe'`/`'Worldwide'`/bare cities resolve to
  `null` so the field is omitted rather than wrong, and a blank column
  keeps the old `'IN'` default. — *verified: `country.ts` exists with
  exactly this logic; `tests/country.test.ts` 5/5 pass, including the
  `'India' → 'IN'` and `'Europe' → omitted` cases specifically.*
- `skills`, `educationRequirements`, `experienceRequirements` emitted
  from the structured-enrichment fields.
- `baseSalary` currency/period detection (`salaryToBaseSalary()`):
  currency comes from the text instead of always assuming INR; lakh/k/LPA
  multipliers applied; unresolvable currency/period omits the field.
  — *verified: function exists in `structuredData.ts`; salary tests
  18/19/20 pass.*

### Breadcrumbs
- `breadcrumbSchema()` + `<Breadcrumbs>` wired into every hub and detail
  page (`/jobs`, `/internships`, `/remote-jobs`, `/government-jobs`,
  `/japan-jobs`, `/japan-internships`, `/europe-jobs`, `/skills`,
  `/skills/[skill]`, `/companies`, `/companies/[company]`, `/jobs-in`,
  `/jobs-in/[city]`, `/tools/[tool]`, `/careers/[role]`,
  `/resume-for/[role]`, `/tracker`, plus all four detail templates).
- Duplicate hand-written `<nav>` breadcrumb trails removed from the seven
  pages that were rendering both the schema-driven component and a
  leftover manual one.

### Enrichment pipeline
- Quality gate (`processors/quality.py`, migration 020): hard-rejects
  postings whose apply URL is a homepage/listing/blog/aggregator
  redirect; assigns `legitimacy_state`, `is_thin`, `quality_score` (0–100)
  to everything that survives. — *verified: file and migration both
  present.*
- `is_thin`/`quality_score` are in `JOB_COLUMNS`, so the sitemap and
  detail-page `robots: { index: false }` logic can actually act on them.
  — *verified via grep.*
- Content-enrichment priority sorts thinnest-first instead of
  scrape-order; `ai_enriched` vs `template_fallback` reported separately;
  a warning fires when an entire run falls back to template content.
- Structured job details (Education / Key Skills / Notes / Experience):
  migration 021, `structured_enrichment.py` (Groq path + rule-based
  fallback), `StructuredDetails.tsx`. — *verified: all three files
  present.*
- `enrich_all_content.py`'s structured-backfill default query now has
  `ORDER BY posted_at DESC NULLS LAST` (previously no `ORDER BY` at all —
  a real bug, now fixed and covered by
  `test_structured_enrichment_retry.py`, part of the passing 71).
- A genuine full-backlog `bulk=True` backfill path exists for both
  overview and structured enrichment, scheduled via
  `.github/workflows/job-content-enrichment.yml` and
  `phase-b-structured-backfill.yml` — *verified: both workflow files
  exist in `.github/workflows/` in this zip* (an earlier session's doc
  said this folder wasn't present in the zip it was working from — that
  caveat does **not** apply to this upload; see Corrections).
- `--no-fallback` / `--redo-fallback` flags: Groq-only writes, exit code 2
  if the API key is missing (turns the workflow red instead of silently
  writing template text), exit code 3 if a run attempts rows but enriches
  none.
- Bulk-mode overwrite bug fixed: rule-based fallback no longer clobbers a
  good Groq-written `structured_description` — only fills rows that are
  still `NULL`.
- `content-enrichment.yml` (the old workflow that silently wrote and
  locked in template fallback text) is confirmed **removed** from
  `.github/workflows/`; replaced by `job-content-enrichment.yml`.
  — *verified: file absent, replacement present.*
- Internshala scraper no longer joins keywords into one garbled query;
  browses the main feed directly plus per-keyword as a secondary pass.
  — *verified in `scrapers/internshala.py`, matches the described fix.*
- Active liveness checking: `check_liveness_for_aging_jobs()` HEAD-checks
  jobs aged 2–14 days in addition to the existing 30-day sweep.

### Company profiles
- Fact-only company profiles (`company_facts_service.py`, migration 023)
  replaced the earlier Groq/LLM-guessed version
  (`company_enrichment_service.py`). — *verified: the facts service and
  migration exist; the old Groq service file is confirmed deleted.*
- `enrich_all_content.py --target companies` wired in, scheduled nightly
  via `.github/workflows/company-enrichment.yml`. — *verified: `--target
  companies` is a valid choice, `enrich_companies()` exists, workflow file
  present.*
- `GET /api/companies/{company}/profile` returns
  `overview, keywords, facts, model, enriched_at`, 404s with no overview.
  — *verified route exists in `routes/companies.py`.*

### Filters & facets (Phase 1–2)
- `GET /api/jobs/facets` server-side aggregation endpoint.
  — *verified in `routes/jobs.py`.*
- Multi-select filters (`skills=`, `courses=`, `sources=`, `batches=`,
  `companies=`) pushed server-side as SQL conditions.
- `india_only` / `india_first` query params move the client-side
  `isIndiaJob()`/`sortIndiaFirst()` logic into SQL so pagination works
  correctly against a single paged response. — *verified: both params
  present with the described behavior in `routes/jobs.py`.*
- `getJobsPage()` returns `{ jobs, total }`; stale `?page=` past the end
  clamps to the real last page.
- `AdvancedJobFilters.tsx`, `JobTags.tsx`, `facets.ts`, `filterJobs.ts` —
  *all verified present.*

### Programmatic SEO expansion (Phase 3)
- Batch/passout-year hub pages (`/batch/[year]`, five curated years,
  `sitemap-batches.xml`). — *verified: `app/batch/page.tsx`,
  `app/batch/[year]/page.tsx`, `app/batch/data.ts` all present.*
- Minimum-listing thresholds (`lib/seo/hubThresholds.ts`:
  `SKILL_MIN_JOBS = 5`, `LOCATION_MIN_JOBS = 3`, `BATCH_MIN_JOBS = 3`),
  applied as a soft `robots: { index: false, follow: true }` gate.
  — *verified file exists.*
- Pre-generated OG images per job (`app/og/[filename]/route.tsx`, Next 14
  `ImageResponse`, edge runtime, cached with `s-maxage=2592000`).
  — *verified route file exists.*
- hreflang audit for filter query params — confirmed no code change was
  needed (canonical/`languages` are built from hardcoded path literals,
  never `searchParams`).

### Non-www migration & pagination
- `ORDER BY posted_at DESC NULLS LAST, id DESC` deterministic pagination
  on `/api/jobs/` and hackathons list. — *verified via grep.*
- IndexNow / Google Indexing push URLs build non-www.

### Gone-job (410) handling
- Replaced per-job-ID cache with one shared "recently gone" `Set`,
  refreshed every 10 minutes, backed by `GET /api/jobs/gone-ids`
  (bounded, `GONE_IDS_MAX_DAYS=30`, `GONE_IDS_MAX_ROWS=20000`). Same
  fail-open contract as before. — *verified: both `lib/goneJobs.ts` and
  the `/gone-ids` route exist and match the described shape exactly.*
  This closes IMPLEMENTATION_PLAN.md §4, which had proposed this as a
  future change — it's since been built.

### Locale / hreflang
- Dynamic `<html lang>` via `x-locale` header, with `middleware.ts` fixed
  to set it on the *request* headers (not just the response) so Server
  Components' `headers()` actually see it same-request.
- hreflang switched off site-wide (`lib/hreflang.ts`, `HREFLANG_ENABLED =
  false`) because canonical said "duplicate of English" while hreflang
  said "this is the Spanish version" — contradictory signals. All
  emitters route through `hreflangLinks()`. — *verified: `lib/hreflang.ts`
  exists; `tests/hreflang.test.ts` 4/4 pass, including the regression
  guard that no route hand-rolls its own locale alternates.*
- `app/sitemap-blog.xml/route.ts` now calls `hreflangLinks()` instead of
  hand-mapping `i18n.locales` itself — *this was the one file still
  failing the regression guard as of the last CI log you pasted; it's
  fixed in this zip (verified directly, test 17/50 passes).*
- Locale-prefixed job **detail** pages (`/es/jobs/<slug>` etc.) are
  `Disallow`ed in `robots.txt` (not noindexed) since they duplicate
  English content and aren't in any sitemap; locale **list** pages stay
  crawlable (trailing-slash-scoped rule). — *verified via
  `tests/country.test.ts`'s robots.txt assertions, which pass.*

### Scrapers (Phase 1)
- New ATS adapters: `recruitee.py`, `teamtailor.py`, `bamboohr.py`,
  `breezyhr.py`, `personio.py`, `freshteam.py`. — *all verified present.*
- New board scraper: `naukri.py` (parses `__NEXT_DATA__`, falls back to
  CSS selectors). — *verified present.*
- Discovery scraper: `dorker.py` (Bing-dork queries against
  Greenhouse/Lever/Ashby/SmartRecruiters/Workable, tags results
  `source='dorker'`). — *verified present.* **Not live-verified** —
  the build sandbox has no general internet access, so board-slug
  resolution and hiring.cafe's live response shape were never confirmed
  against the real sites. Worth a manual check.

### Phase F — same-day priority indexing
- `phase_f_priority_index_push.py`, migration 022
  (`indexnow_submitted_at`/`google_indexing_submitted_at` +
  `priority_index_log`), `.github/workflows/phase-f-priority-index.yml`
  (6×/day). — *verified: script, migration, and workflow all present.*
  IndexNow leg works standalone; the Google Indexing API leg needs
  `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` set on the EC2 box — that's an
  operational step, not something a code check can confirm either way.

---

## ❌ Not implemented / still open

- **Genuine per-locale job content.** No `job_translations` table, no
  locale-aware hreflang for job pages, no translated rendering.
  — *verified: no file or table matching "job_translations" anywhere in
  the repo.* This is explicitly called the largest remaining item across
  three separate docs (IMPLEMENTATION_PLAN §7, REPO_AUDIT, PHASE_PLAN
  Session 3/4) and a locale list still needs to be decided before it's
  worth building.
- **Company profiles aren't rendered on the company page yet.**
  `app/companies/[company]/page.tsx` doesn't call the profile endpoint.
  — *verified: no `profile` reference in that page file.* The backend
  (facts service, migration, route) is done; this is purely a frontend
  wiring gap.
- **More ATS providers** (Phase 2 scope): Workday CXS, iCIMS,
  SuccessFactors, Zoho Recruit, Keka, Darwinbox, Eightfold, Comeet, Hibob,
  Zwayam — deferred, need more involved auth than the public-JSON Phase 1
  pattern.
- **More board scrapers**: Wellfound, Bayt, Glassdoor, HackerNews "Who's
  Hiring" — deferred, each has its own markup quirks.
- **Direct company career-page scrapers** (Google, Amazon, Microsoft,
  Apple, Uber, Meta, Nvidia) — `company_portals.py` pattern exists
  (`tech_mahindra`/`tcs`/etc.) but isn't extended to these.
- **`company_portals.py`, `unstop.py`, `cutshort.py`** — still fragile
  per-selector scraping against JS-heavy SPAs; flagged as needing a
  structural rebuild against each site's API/GraphQL, not more selector
  patching.
- **Liveness/legitimacy verifier for dorker-discovered boards** — before
  treating a dorker-found board as fully trusted, run it through
  `quality.py` with a higher bar than hand-curated boards. Not built.
- **Ashby/SmartRecruiters board lists** — swapped to more plausible
  companies but **not live-verified** (no general internet access in the
  build sandbox); may contain dead slugs.
- **Monetization scripts left in place, not evaluated.** `nap5k.com` push
  tag (4 list pages), `n6wxm.com` interstitial (internship detail pages),
  `3nbf4.com` push service worker (`public/sw.js`). — *verified: all
  three still present across `InternshipDetailAds.tsx`, `sw.js`, and the
  four list pages.* Flagged as a plausible page-experience/quality drag
  worth A/B testing off; explicitly left as the site owner's revenue
  trade-off to make, not a code task.
- **Phase 0 (confirm what's actually live in production)** — inherently
  a manual check against the deployed site (canonical tag on a live job
  page, robots.txt contents, filter-bar duplication, deploy pipeline).
  Can't be resolved from a code drop.
- **Phase E (re-verify GSC reports after re-crawl)** — blocked on Phase
  A/B being live in production plus a 2–3 week re-crawl window. Not a
  code task; nothing to check in this zip.
- **`GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON`** not set (operational
  prerequisite for Phase F's Google Indexing API leg — code path exists
  and degrades gracefully to IndexNow-only without it).
- **`INTERNAL_API_KEY`** not confirmed set on both API host and Vercel
  (operational prerequisite for the SSR rate-limit exemption to activate —
  code is inert, not broken, without it).
- **9-locale scope decision** — `i18n/config.ts` has 9 locales
  configured; multiple docs recommend picking 2–3 (es/pt as the largest
  non-English job-market languages) before building real per-locale
  content, rather than translating and maintaining all 9. Not decided.

---

## ⚠️ Corrections to the source documents

These are places where an earlier doc's own status line no longer
matches the code, because a later session fixed it — noted here rather
than silently absorbed as fact:

1. **`.github/workflows/` — CHANGES_THIS_SESSION.md's caveat is stale for
   this upload.** That doc says the workflows folder "isn't present in
   this zip (`create_zip.py` skips all dotfiles/dotdirs)" and that
   `phase-b-structured-backfill.yml` is a best-effort reconstruction,
   unverified against the real `content-enrichment.yml`. **In this zip,
   `.github/workflows/` is present** with five files
   (`backend-cicd.yml`, `company-enrichment.yml`,
   `job-content-enrichment.yml`, `phase-b-structured-backfill.yml`,
   `phase-f-priority-index.yml`), and `phase-b-structured-backfill.yml`
   already has the 40-minute `command_timeout` / 25-minute budget /
   `03:30` cron the caveat asked someone to go check. Whether it's a
   byte-for-byte match to what's actually deployed on GitHub still can't
   be confirmed from a zip — but the "isn't present at all" caveat no
   longer applies.
2. **`addressCountry` — IMPLEMENTATION_PLAN.md §6 says this is blocked on
   a production data query and unimplemented.** It has since been built
   (Session 4, per PHASE_PLAN.md, and independently verified above via
   `lib/country.ts` + passing tests) using a general ISO-3166 resolution
   approach rather than a hand-written city→country lookup table, which
   sidesteps needing the production distinct-values query at all. §6 is
   superseded.
3. **`sitemap-blog.xml`'s hand-rolled locale alternates** — the CI log
   from earlier in this conversation showed `hreflang.test.ts`'s
   regression-guard test failing specifically because
   `app/sitemap-blog.xml/route.ts` built its own alternates instead of
   using `lib/hreflang.ts`. That's fixed in this zip (verified directly:
   the route now imports and calls `hreflangLinks()`, and the full test
   suite — including that specific test — passes 50/50).
4. **`quality_score` thresholds (50 / 75) are still explicitly
   placeholders**, not a confirmed-correct scale, across every doc that
   mentions them (IMPLEMENTATION_PLAN, REPO_AUDIT, PHASE_PLAN). No doc
   claims otherwise, so this isn't a contradiction — just flagging that
   "implemented" here means "the tiering logic works as designed," not
   "the specific numbers are validated against real data."
# SEO Plan — Remaining Items

Everything not yet done on the ML-engineer-article SEO plan, and why.

## Needs your job-listings data (Phase 7 — the real blocker)

- **Chart data pipeline** — skill frequency, experience distribution, salary
  ranges, tech clusters, location/work-arrangement distribution. Charts
  currently render nothing rather than fake numbers.
- **Sample size + "last updated" trust line** (e.g. "Based on 1,248 listings").
- **Sourcing every stat/claim** to a method + sample size.

## Real features, not SEO fixes

- **`interactiveFilters` / `dataExplorer`** — a live filtering UI backed by
  the jobs API. Faking it with static markup would be worse than omitting it.

## Needs a decision from you (not a coding task)

- **One-off vs. new content format** — is the ML article a prototype for
  more like it, or a one-off? Everything above hinges on this answer; if
  it's a one-off, most of this list disappears and the article just gets
  normalized back to a plain string body instead.
- **Topic-cluster linking** across ML/AI/MLOps/resume content — an
  editorial/content-strategy call, not something to infer from code.

## Needs live access not available here

- **Confirming the OG image actually resolves** (HTTP 200, correct
  content-type) — `intern-flow.in` isn't in the reachable domain list, so
  the image was generated and wired in, but the live URL wasn't hit to verify.

## Touches other pages / infra, out of scope for "the blog article"

- **Pagination SEO controls** on list pages (self-canonical URLs, no
  accidental indexing of filter combinations).
- **Indexation-health monitoring** (Search Console tracking of
  indexed/duplicate/soft-404 counts) — a GSC/monitoring setup, not code in
  this repo.

## Already correctly deferred, no action needed

- **hreflang** — intentionally gated off until real per-locale translations
  exist; enabling it now would be premature, not an oversight.
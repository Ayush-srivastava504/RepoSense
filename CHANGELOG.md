# Changelog

History of engineering sessions on RepoSense (InternFlow), newest first. This file
replaces `SESSION_7_CHANGES.md` through `SESSION_15_CHANGES.md`, `FIXES_APPLIED.md`,
`REPO_AUDIT_2026-09-20.md` and the "Implemented" half of `Project_Status.md` — all
merged here and removed so the root folder has one history doc instead of nine.
Open/backlog items live in `TODO.md` instead of here.

---

## 2026-10-22 — SEO audit fixes

Found during an SEO audit of the live site (`apps/web`) and fixed same session.

- **Job titles with scraped artifacts reached `<title>`/`<h1>`/OG tags/JSON-LD
  unsanitized** — e.g. a listing titled `System Development Engineer,, DSP Analytics`
  (doubled comma) rendered verbatim everywhere, and on long titles the pixel-truncation
  in `buildJobTitle()` (`lib/seo/seoMetrics.ts`) dropped the company name off the
  `<title>` entirely to make room. Fixed at the single chokepoint every `Job` passes
  through: `normalizeJobTitle()` + `normalizeJob()` in `lib/jobs.ts`, applied in both
  `coerceJobs()` (list endpoints) and `getJobById()` (detail endpoint, which bypassed
  `coerceJobs`). Collapses repeated punctuation/whitespace once, at the source, so
  every downstream consumer of `job.title` is clean automatically. Covered by a new
  test in `tests/seo-helpers.test.ts`; `seo-helpers.test.ts` suite: 12/12 pass.
- **Homepage H1 had no whitespace between its two text nodes.** `HomeHero.tsx`'s H1
  splits across a block-level `<span>` (`Jobs & internships for` + block `B.Tech
  freshers in India`); visually it wraps fine, but the flattened text content (what
  crawlers, screen readers and view-source read) was `forB.Tech freshers in India` —
  no space — for all five rotating degree keywords. Fixed with an explicit `{' '}`
  between the two nodes; purely a text-node change, nothing moves visually.

---

## Session 15 — company intel fix, company-page 500, new companies/roles

- **Company intel bug**: `pipeline._store_wikidata` still passed 7 args to
  `UPSERT_SOURCE_SQL` (6 params since the Session 14 FAQ removal) — asyncpg raised on
  every `crawl` with Wikidata enabled. Fixed + regression test. `run.py` now logs and
  skips a failing company instead of aborting the whole batch.
- New `manual_companies.py` / `seed_manual()`: curated employers with verified official
  domains (TCS, Infosys, Wipro, HCLTech, Tech Mahindra, Cognizant, Capgemini, Accenture,
  GlobalLogic, LTIMindtree, Deloitte, EY, KPMG, PwC, Zoho, Zeta, Caterpillar, ...);
  `domain_source='manual'` rows are never overwritten by job-derived domains.
- **`/companies/[company]` 500 fixed**: `GET /api/companies/by-slug/{slug}` now
  normalizes bullets/source_urls, tolerates a missing company_intel schema, and falls
  back to the jobs table so any company with live jobs resolves (previously 404/500 for
  companies outside the top 200). `GET /api/companies/{company}/profile` now 404s
  instead of 500 on bad/missing facts. Web side: `normalizeIntel`/`normalizeProfile`
  absorb text-jsonb, null arrays, missing `facts.experience`; `generateMetadata` never
  throws; secondary fetches use `Promise.allSettled`; new `error.tsx` boundary.
- **Crawler**: added graduate/trainee/QA-testing title keywords, new `QA & Testing`
  category, more ATS candidates (SmartRecruiters/Workday tenants) for the manual-company
  list — flagged unverified since the build sandbox has no internet; run
  `probe_boards.py workday smartrecruiters` on EC2 to confirm.
- Tests: `pytest services/company_intel` 19/19; `tsc --noEmit` clean; `tsx --test`
  149/150 (the one pre-existing failure flags a www-host mention in a docs file, not
  code).

## Session 14 — remove FAQ groundwork, company-page SEO pass

- **FAQ code removed** site-wide to match the "intentionally deferred" decision:
  `extract_faq`/`Page.faq` (company_intel), `faq_json()` (db.py), the FAQ query +
  `MAX_FAQ_PAIRS` in `routes/companies.py`, `CompanyFaq.tsx`, and the FAQPage JSON-LD on
  `/companies/[company]`. Migration `035_drop_company_faq.sql` drops the column
  (idempotent whether or not `034` ever ran). `faqSchema()` itself stays — still used by
  jobs, skills, tools and blog pages.
- **Company page SEO**: profile panel + topic sections render on page 1 only (was
  duplicate content on every `?page=N`); H1 changed to "`<Company>` jobs &
  internships" to match the title tag; page 1 shows a visible "N active listings..."
  line matching the meta description.
- **Job detail pages**: Apply/Save moved above the fold; new enriched sections
  (role & responsibilities, how to prepare, common mistakes, resume keywords) from
  migration `036` / `job_sections_service.py`, every number and keyword validated
  against the listing text (no template filler); "About `<company>`" now pulled from
  the company_intel overview topic; FAQ answers are always visible (no tap-to-expand),
  built from real job fields via `lib/jobFaq.ts`, and the FAQPage JSON-LD uses that same
  function so markup matches visible text.
- Verification: `tsc --noEmit` clean; `tsx --test` 101/101; `pytest
  services/company_intel` 16/16.

## Session 10 — Phase 4 SEO fixes + company logo fix

- `jobPostingSchema()`/`eventSchema()` now return `null` (script omitted) instead of
  emitting truthy-but-wrong data when required location/date fields can't be stated
  truthfully. New `companyOrganizationSchema` (logo/sameAs only for verified official
  domains).
- `/companies/[company]`: paginated pages get "— Page N" in title/description;
  `COMPANY_MIN_JOBS = 2` + `companyIsThin()` → `noindex` under threshold, dropped from
  `sitemap-companies.xml`.
- Company logos: `lib/logoDomain.ts` excludes job-board/ATS/social domains from ever
  being used as a logo (falls back to a letter avatar); `CompanyLogo.tsx` also falls
  back below 32px (Google's placeholder-globe size).
- **New: company intelligence crawler** (`services/company_intel/`, separate from the
  job crawler). Migration `033_company_intel.sql`
  (`company_entities`/`company_sources`/`company_topics`); fetcher respects robots.txt,
  rate limits, and guards against off-site redirects; LLM grounding validation rejects
  ungrounded numbers/names/fluff; Groq → Gemini → NVIDIA fallback chain. New API routes
  and web `CompanyTopics` component. Weekly workflow (`company-intel.yml`).

## Session 9 — chart aggregation + Phase 4 repo-side fixes

- **Nightly chart aggregation**: migration `031_chart_stats.sql`; `chart_aggregator.py`
  groups active listings by `segment_key`/editorial topic, stores skills/experience/
  work-mode % with denominators; keys under 25 listings are not stored (never fakes a
  chart). `GET /api/charts/{chart_key}`; web renders via `StatBarChart` with a
  "Based on N listings · updated `<date>`" line. Salary chart intentionally not built —
  salary is free text and parsing it would be unreliable.
- `/resume` → 308 to `/resume/builder`; HSTS header added; 7 static titles shortened to
  fit the 60-char budget with the `| InternFlow` suffix.
- **Route sitemaps hardened**: a failed API call used to silently shrink
  hackathons/companies/skills/locations/batches sitemaps to a false "removed" signal.
  `getJobsOrThrow`/`getCompaniesOrThrow`/etc. now make failure explicit; `503` +
  `Retry-After: 900` on failure, `s-maxage=3600` cache on success. 15 new tests.
- IndexNow push extended to the non-job sitemaps (migration
  `032_route_sitemap_push_state.sql`): pushes new/changed/removed URLs, capped at 2000
  URLs/run, skips sitemaps that fail or that lost >50% of known URLs (no false removal
  notices).

## Session 8 — government quality gate, chained pipeline, mobile overflow

- **Government quality gate** (hybrid scope): `assess_government_legitimacy` /
  `classify_government_relevance` — verified = official `.gov`/`.nic` domain or 2+
  sources, plus advt no. + last date; `tech_psu` postings (engineer/scientist/IT titles,
  or PSU + trainee/officer title) can reach `full` tier; `general` govt notices are
  capped at quality 60/`standard` content rather than excluded outright.
- **Pipeline chaining + central logging**: `daily-pipeline.yml` now runs enrich → sitemap
  → index (per category) → gone in sequence, with each stage independently resilient to
  the previous one failing where it makes sense. Migration `029_pipeline_runs.sql` logs
  every stage.
- `sitemap_categories` registry (migration `030`) lets a category be toggled off via one
  `UPDATE`, no deploy needed.
- **Mobile overflow, app-wide**: `grid gap-3 sm:grid-cols-3`-style utilities had no
  column template below `sm`, so one long unbroken string (URL/email/scraped title)
  widened the whole grid past the screen on every listing/detail page. Fixed globally in
  `globals.css` (`.grid { grid-template-columns: minmax(0, 1fr) }`, `overflow-wrap:
  anywhere` on page content, `min-width: 0` on chips/panels). Verified in headless
  Chromium with worst-case data at 320/360/390/430px: 458 overflowing elements → 0.
  Also fixed: `.container-xl` losing its width inside a flex column (dashboard
  overflow), 6 search inputs at 14px triggering iOS Safari's focus-zoom.

## Session 7 — sitemap_cache, provider tuning, trust score split, dedupe

- **Root cause of 503s / 19% sitemap coverage**: the web tier paged through
  `/api/jobs` live on every sitemap request (~28 calls/file) and applied a stale
  10/20-day freshness window that silently excluded most 31–90+ day tiered jobs the
  logic was supposed to include. Fixed with `sitemap_cache` (migration
  `028_sitemap_cache.sql`) built by a Python port of the same tiering logic
  (`sitemap_builder.py`, 1:1 tested against the TS version), rebuilt hourly
  (`build-sitemaps.yml`), with an in-memory last-good fallback on the web side instead
  of throwing.
- **LLM provider pacing**: each of Groq/Gemini/NVIDIA now paced to its own RPM budget
  (deliberately under published free-tier limits since these prompts are token-heavy);
  `enrich()` tries whichever provider has the shortest wait first, rather than strict
  round-robin, so a paced-out Groq no longer blocks a row Gemini/NVIDIA could take
  immediately. New `scripts/verify_providers.py` for a live post-deploy check.
- **Fraud score decoupled from "notable employer" status**: `confidence_score` no
  longer gets +20 just for matching the top-company allowlist (that let a scam listing
  squatting on a big name's branding still clear `verified`). Company fame can now only
  ever lower the score, via the existing domain-mismatch penalty.
- **Cross-run fuzzy dedupe**: in-batch dedupe only ever compared jobs within the same
  crawl; a re-scrape from a different source on day 2 got a different id and survived
  as a live duplicate. New `deduplicate_against_db()` fuzzy-matches new jobs against a
  DB-fetched recent set (45-day window), company-bucketed for cost, fails open on any
  DB error.
- `TOP_COMPANY_TIER` changed from a static ~250-name allowlist to allowlist ∪ an
  "earned" DB-computed set (5+ active postings in-window, avg confidence ≥ 70) —
  legitimate, sustained hiring now earns the badge even for companies missing from the
  original curation.
- Flagged, not started this session: government quality-gate scope (needed a product
  decision — resolved in Session 8), general SEO items (H1s/word count/title-length/
  structured-data errors), mobile usability audit (addressed in Session 8).

## Undated fixes pass (pre–Session 7, post-baseline)

- `GONE_IDS_MAX_ROWS` raised `20000 → 100000` — with 61k+ inactive jobs, the endpoint's
  "most-recently-deactivated" cap was dropping the *oldest* zombie listings, the exact
  ones stuck as "Discovered – currently not indexed" in GSC; they were resolving to a
  plain 404 instead of a real 410.
- Removed an unconditional `headers()`/`cookies()` call from the root layout (used only
  to set `<html lang>`) — it forced `DYNAMIC_SERVER_USAGE` on any route param outside
  the pre-rendered set for every `generateStaticParams` + `dynamicParams: true` page,
  producing production 500s.
- `scripts/indexnow-submit-gone.mjs`: submits newly-`410`'d job slugs to IndexNow;
  supports `--since-days` for backlog catch-up (30-day hard max on the API side).
- Explicitly not done at this point: government-jobs vertical (blocked on a product
  decision, later resolved in Session 8), queue-based ingestion/nightly chart
  aggregation (sketched, later built in Session 9).

## 2026-09-20 — baseline (consolidated status check)

A full-repo fact-check against the code (not taken on any doc's word) as of this date,
originally spread across `CHANGES_THIS_SESSION.md`, `Daytodaywork.md`,
`IMPLEMENTATION_PLAN.md`, `INDEXING_RECOVERY_PLAN.md`, `NON_WWW_MIGRATION.md`,
`PHASE_PLAN.md` and `REPO_AUDIT_2026-09-20.md` (none of those files are in the repo any
more — this is what survived verification). Test suites at the time: web
`test:sitemap` 50/50, backend `pytest` 71/71.

**Sitemaps & indexing hygiene** — non-www canonicalization (`lib/site.ts`, www is
301-only); completeness check vs API `total` with a 503 instead of a silently-short
sitemap; tiered sitemap priority (0–30d always, 31–90d needs `quality_score >= 50`,
90d+ needs `>= 75` — thresholds explicitly flagged as placeholders, not yet validated
against real data); `lastmod` real-or-absent, never fabricated or derived from the
crawl-order-dependent `last_seen_at`; `robots.txt` no longer blocks `?page=` or
`/_next/`, and explicitly blocks GPTBot/CCBot/Google-Extended/etc. without touching
real search crawlers; `/login`/`/register` noindexed and out of the sitemap;
`getJobById()` only treats a genuine 404 as "not found" (429/5xx/timeouts throw instead
of faking a 404 to Googlebot); `JobCard` always links via the canonical path instead of
a hardcoded base that could 308-redirect.

**JobPosting schema** — `datePosted` fallback chain `posted_at → created_at →
last_seen_at`; `jobLocation` falls back to a country-level `Place` instead of omitting
the field; `addressCountry` goes through `lib/country.ts`'s ISO-2 normalization
(`'Europe'`/bare cities → omitted rather than wrong); `baseSalary` currency/period
detection with lakh/k/LPA multipliers, omitted when unresolvable rather than guessed.

**Breadcrumbs** — wired into every hub and detail page; duplicate hand-written `<nav>`
trails removed from 7 pages that had both.

**Enrichment pipeline** — quality gate hard-rejects postings whose apply URL is a
homepage/listing/aggregator redirect, scores everything else 0–100; content-enrichment
priority sorts thinnest-first; structured Education/Key Skills/Notes/Experience details
(migration `021`, Groq + rule-based fallback); full-backlog `bulk=True` backfill path
scheduled via GitHub Actions; bulk-mode bug fixed where rule-based fallback was
clobbering good Groq-written content instead of only filling `NULL` rows.

**Company profiles** — fact-only profiles (migration `023`) replaced the earlier
Groq/LLM-guessed version; nightly enrichment workflow; `GET
/api/companies/{company}/profile`.

**Filters & facets** — `GET /api/jobs/facets`; multi-select filters pushed server-side
as SQL conditions; India-only/India-first logic moved server-side so pagination works
against a single paged response.

**Programmatic SEO** — batch/passout-year hub pages; minimum-listing thresholds per hub
type, applied as a soft `noindex, follow` rather than a hard block; pre-generated OG
images per job, cached 30 days.

**Gone-job (410) handling** — shared "recently gone" `Set`, refreshed every 10 minutes,
backed by `GET /api/jobs/gone-ids` (this is the endpoint whose row cap the undated
fixes pass above later raised from 20,000 to 100,000).

**Locale / hreflang** — `<html lang>` set correctly same-request via middleware;
hreflang switched off site-wide pending a real per-locale translation decision (not an
oversight — see `TODO.md`); locale-prefixed job *detail* pages blocked in `robots.txt`
(duplicate content, not in any sitemap) while locale *list* pages stay crawlable.

**Scrapers** — new ATS adapters (Recruitee, Teamtailor, BambooHR, BreezyHR, Personio,
Freshteam); Naukri board scraper; a Bing-dork discovery scraper (`dorker.py`, flagged
not live-verified — no internet access in the build sandbox at the time).

**Phase F — same-day indexing** — IndexNow + Google Indexing API push on deactivation,
6×/day; IndexNow leg works standalone, the Google Indexing API leg needs
`GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` set (an operational step, not a code gap).

Anything from this baseline that was still open as of 2026-09-20 is carried forward,
re-checked against the current repo, in `TODO.md` rather than repeated here.

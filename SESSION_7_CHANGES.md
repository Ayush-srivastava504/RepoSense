# Session 7 — sitemap_cache, provider tuning, trust score split, dedupe, featured jobs, earned top-companies

## 1. `sitemap_cache` table + scheduled builder — root cause of the 503s / 19% coverage — DONE
The web tier's sitemap routes used to page through `/api/jobs` live on every request
(~28 calls per sitemap file, shared across 4 categories), throwing `IncompleteSitemapError`
→ 503 on any 429/rate drift, and applying `_freshness_conditions()`'s 10/20-day windows,
which silently excluded most of the 31-90/90+ day tiered jobs the sitemap logic was
*supposed* to include (the real cause of the low coverage, not just the 503s).

- `database/migrations/028_sitemap_cache.sql` — `sitemap_cache(file_name, category, page, url_count, xml, built_at)`.
- `src/services/sitemap_builder.py` — builds all category files directly from the `jobs`
  table (Python port of `isJobForSitemap`/`isIndexableJob`/slug rules, tests pin it 1:1).
  Refuses to shrink the cache by >50% or write 0 URLs unless `--force` (protects against a
  bad deploy silently emptying the sitemap).
- `src/routes/sitemap.py` — `GET /api/sitemap/files`, `GET /api/sitemap/files/{name}`, read-only.
- `scripts/build_sitemaps.py` + `.github/workflows/build-sitemaps.yml` (hourly, `docker compose exec`).
- Web side: `lib/sitemapJobsSource.ts` now reads the two new endpoints (with an in-memory
  last-good fallback instead of throwing), `app/sitemaps/[file]/route.ts` and
  `app/sitemap.xml/route.ts` updated. `lib/sitemapJobs.ts`'s pure helpers are untouched/still
  unit-tested — they're now only the spec the Python builder mirrors.
- Tests: `services/api/tests/test_sitemap_builder.py` (5 tests). `tsc --noEmit`: clean.
- **Before first deploy:** run `python scripts/build_sitemaps.py` once manually (empty cache
  the first time → 503 from `/api/sitemap/files` until it's populated).

## 2a. Groq RPM tuning + Gemini/NVIDIA fallback verification — DONE (+ live check script)
- `llm_providers.py`: each provider now paced to a requests-per-minute budget
  (`GROQ_RPM`/`GEMINI_RPM`/`NVIDIA_RPM` env, default 12/10/20 — deliberately under
  published free-tier RPM since these prompts are token-heavy and TPM/TPD usually bites
  first). `content_enrichment_service.enrich()` tries the provider with the *shortest*
  wait first each row, instead of only walking round-robin order, so a paced-out Groq no
  longer blocks a row when Gemini/NVIDIA could take it immediately.
- A provider rejecting `response_format` (400, e.g. some NVIDIA-hosted models) is now
  retried once as plain text instead of being written off as a dead provider.
- `REQUEST_DELAY_S` blanket per-row sleep now defaults to `0` (was 20s) — pacing lives
  per-provider now; set `ENRICH_REQUEST_DELAY_S` to re-add a floor if you want one.
- **New: `scripts/verify_providers.py`** — live check, run on the server:
  `docker compose exec -T api python scripts/verify_providers.py`. Hits every configured
  provider/model once, prints latency + whether the model id 404s (retired). Run this after
  deploy to actually confirm Gemini/NVIDIA fall back correctly in production — the repo has
  no way to hit real provider APIs itself.
- Tests: `tests/test_provider_resilience.py` (+3 new: fallback chain, RPM pacing/ordering,
  response_format retry). 11/11 pass.

## 2b. Split fraud score from "notable employer" score in `trust.py` — DONE
`confidence_score` used to add +20 just for being on `TOP_COMPANY_TIER`, so a scam listing
squatting on "Google"/"TCS" scraped from a random unofficial domain could still clear
`verified` on brand recognition alone, while an equally-real small company on its own
official domain scored lower for being unfamiliar.

- Removed the `+20 is_known_company` line from `confidence_score`. Company fame can now only
  ever pull the score **down** (via the existing `is_mismatch` penalty: a top-tier name posted
  from a low-similarity, non-ATS, unofficial domain is still a real anomaly signal).
  `confidence_score` is now purely about "is this specific apply link trustworthy".
- Added `job['is_notable_employer']` (== the old `is_known_company` bool) as its own field —
  purely informational from `trust.py`'s side; the ranking bonus/`is_top_company` badge already
  live in `routes/jobs.py` (untouched here, see 3c).
- Not covered by an automated test — `services/api/crawler` has no test suite/harness at all
  (no `tests/` dir; `boto3`/`psycopg2` import at module load time makes it heavier to stub than
  the API side). Manually verified via a scratch script instead (see chat) — worth adding a real
  `crawler/tests/` harness at some point, called out here rather than silently skipped.

## 3a. Cross-run fuzzy dedupe against DB — DONE
In-batch fuzzy dedupe (`_fuzzy_dedup`, title+company similarity ≥0.82) only ever compared jobs
*within the same crawl run*. A listing re-scraped from a different source on day 2 gets a
different `id` (hash includes source+url), so exact-id dedupe never caught it either — it
survived as a live near-duplicate second listing.

- `dedupe.py`: new `deduplicate_against_db(new_jobs, existing)` — company-bucketed (cheap) fuzzy
  match against a DB-fetched set of `{title, company}` from currently-active, recently-posted
  rows. Reuses the same `_similarity`/`TITLE_SIMILARITY_THRESHOLD` as in-batch dedupe.
- `utils.py`: `fetch_recent_jobs_for_dedupe(days=45)` — best-effort (returns `[]` and logs a
  warning on any DB error, never raises) so a transient DB hiccup degrades to "skip cross-run
  dedupe this run", not a failed crawl.
- Wired into `index.py`'s `run_pipeline`, right after the existing in-batch dedupe step, wrapped
  in its own try/except for the same reason.
- Verified manually (scratch script, see chat) — dropped both an exact and a fuzzy title match
  against an "existing" company/title pair, kept a different-company and a different-title job.

## 3b. Featured-jobs query fix — DONE
`GET /api/jobs/featured` used a bare `posted_at > now() - interval '14 days'` — two real bugs:
it excluded every job with `posted_at IS NULL` outright (can never be featured no matter how
good the listing), and it never checked `deadline` at all, so an already-expired listing could
still be shown as "featured" (`is_active` can lag a missed cleanup pass — see that field's own
docstring elsewhere in this file).
- Swapped in `_freshness_conditions()` — the same NULL-tolerant, deadline-aware window every
  other listing endpoint in this file already uses.
- Regression test: `tests/test_featured_jobs_query.py` (source-level: asserts the old bare
  clause is gone from the function body and `_freshness_conditions()` is used).

## 3c. `TOP_COMPANY_TIER` → earned signal — DONE
The ~250-name hardcoded allowlist was a single point-in-time curation call: a company hiring
heavily and legitimately today but missing from the list gets no ranking boost or
`is_top_company` badge, and the list can't reflect the site's own data.
- `routes/jobs.py`: new `_top_companies(pool)` — the static list, now documented as a **cold-start
  seed only**, unioned with a DB-computed "earned" set (`_earned_top_companies`): a company
  earns top-tier by having ≥`EARNED_TOP_MIN_JOBS` (5) distinct active postings in the freshness
  window with average `confidence_score` ≥ `EARNED_TOP_MIN_AVG_CONFIDENCE` (70) — i.e. sustained
  *and legitimate* hiring, not just volume. Cached in-process 30 min; falls back to the seed
  list alone (never raises) if the query fails.
- All 4 call sites in `routes/jobs.py` (`get_jobs` ×2, `get_similar_jobs`, `get_job`) and
  `routes/companies.py`'s company-tiering switched from the static `_lower_top_companies()` to
  `await _top_companies(pool)`.
- Tests: `tests/test_earned_top_companies.py` (union, caching, fallback-on-failure). 103/103
  backend tests pass overall.

## 3d. Government quality-gate collision fix — NOT STARTED, still needs your call
Deliberately untouched, per Session 6's own note (still true): the scrapers/schema already
support `is_government`/`department`/`vacancies`/`notification_number`, but *which* notifications
should actually clear the bar to publish is a content-quality judgment call, not something to
infer from the repo — a single SSC/UPSC notice can cover dozens of unrelated post categories.
Your message described this as **sarkari-naukri-wide vs. tech/PSU-only** — i.e. the actual open
question is scope: should the government-jobs section surface any government notification
(sarkari-naukri style, broad reach but lower relevance to this site's core audience), or only
technical/PSU (public-sector-undertaking, e.g. ISRO/DRDO/BHEL-style technical roles) postings
that match the rest of the catalog? That's a product decision for you, not a bug to fix blind —
happy to implement either direction (or a hybrid, e.g. PSU-tech ranked above general sarkari
notices rather than excluded) once you pick.

## 4. SEO items (H1s, word count, Cloudflare email-obfuscation toggle, /resume 404,
title-length rule, duplicate meta, structured-data errors, HSTS, thin internal-linking) — NOT STARTED
## 5. Mobile usability audit — NOT STARTED

Not reached this session — flagging rather than guessing at scope. Most of these are small,
independent fixes (a redirect, a header, a duplicate `<meta>` tag) that are quick once
scoped against a live Search Console/PageSpeed report rather than the repo alone (e.g.
"structured-data errors" and "thin internal-linking" need the actual GSC error list to target
correctly; HSTS is a Cloudflare/Vercel dashboard setting, not repo code; the mobile audit needs
a real device/Lighthouse pass). Worth a follow-up session scoped against that live data rather
than guessed at from the code.

# Stage 4 implementation plan — grounded in the actual repo

Every item below is checked against the code in `RepoSense-master-stage3-audit.zip`,
not assumed. "Current state" cites the real file/line. One correction up front:

> **The pasted plan assumes 5 languages. The repo actually has 9**: `i18n/config.ts`
> lists `en, es, ja, fr, de, pt, ko, it, hi`. The architecture below is written for
> "however many locales you decide to translate," but you should pick the real
> number before Phase 4 — translating and maintaining 8 non-English locales is a
> materially bigger ongoing cost than 4.

---

## 1. Sitemap priority — replace the binary 14-day cutoff with tiers

**Current state** (`lib/sitemapJobs.ts:128-140`): `isJobForSitemap()` is a single
rule — indexable AND `enriched_overview` present AND `posted_at`/`last_seen_at`
within `SITEMAP_RECENT_DAYS = 14`. Everything older is excluded outright, however
good it is. The per-category, 1,000-URL-per-file, numbered-file architecture
(`jobs-1.xml`, `jobs-2.xml`, ... via `chunkEntries`/`sitemapFileName`) **already
exists** — that part of the pasted plan is done, not a gap.

**Change** — replace the single window with tiers, using `quality_score`
(already in `JOB_COLUMNS`, already fetched) as the "still valuable" signal for
older jobs instead of guessing:

```ts
// lib/sitemapJobs.ts
export function isJobForSitemap(job: SitemapJob, now: number = Date.now()): boolean {
  if (!isIndexableJob(job)) return false;
  if (!job.enriched_overview) return false;
  const ref = job.posted_at || job.last_seen_at;
  const ageMs = ref ? now - new Date(ref).getTime() : NaN;
  if (Number.isNaN(ageMs)) return false;
  const ageDays = ageMs / 86400000;
  if (ageDays <= 30) return true;                              // 0-30d: always
  if (ageDays <= 90) return (job.quality_score ?? 0) >= 50;     // 31-90d: enriched + decent quality
  return (job.quality_score ?? 0) >= 75;                        // 90d+: only clearly strong listings
}
```

(`quality_score`'s actual scale needs a one-line check — `SELECT min, max, avg
FROM (SELECT quality_score FROM jobs) x` — before picking 50/75; the shape is
right, the thresholds are a placeholder until you confirm the real
distribution.)

Nothing else here needs to change: `collectAllJobs`, `chunkEntries`,
`categorySitemapUrls`, the `sitemap-jobs.ts` route and its cache are all
tier-agnostic — they just consume whatever `buildCategorySitemapEntries`
returns.

**Old jobs never disappear from the site** either way — this function is
sitemap-only (the comment at `sitemapJobs.ts:117` is explicit about that), the
job's own page stays indexed on `isIndexableJob()` regardless of sitemap
membership. No change needed there; the pasted plan's "don't noindex old jobs"
concern is already satisfied by the existing split.

---

## 2. Enrichment queue priority — one real fix, one already-done

**Already correct, no change needed:**
- `scripts/enrich_job_content.py:31-35` — both branches already
  `ORDER BY posted_at DESC NULLS LAST` (or `enriched_at NULLS FIRST,
  posted_at DESC NULLS LAST` with `--force-stale`). New jobs are already
  enriched before the backlog.
- `scripts/enrich_all_content.py:43-48` (`enrich_jobs`) — same ordering,
  same story.

**Real bug** — `scripts/enrich_all_content.py:83`, the structured-backfill
default path (`--target structured`, no `--force-stale`, which is what
`phase-b-structured-backfill.yml` actually runs daily):

```python
query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND structured_description IS NULL LIMIT $1"
```

No `ORDER BY` at all — Postgres returns whatever physical order it finds,
so this *is* "grab the next N rows" with no recency bias, exactly what the
pasted plan flags. Fix:

```python
query = "SELECT id, title, company, location, description, type FROM jobs WHERE is_active = true AND structured_description IS NULL ORDER BY posted_at DESC NULLS LAST LIMIT $1"
```

One-line fix, covered by an existing test file (`tests/test_structured_enrichment_retry.py` — extend it with an ordering assertion rather than writing a new suite).

**No dynamic 70/30 split needed** — the `NULLS LAST` ordering already gives
you "process new jobs first, fall through to backlog only once new jobs are
exhausted" for free, which is the "dynamic" version the pasted plan says it
prefers over a fixed split.

---

## 3. Company enrichment — not coupled to job enrichment, just unused

> **Status: done in Session 3, but not as sketched below.** The LLM-based approach in this
> section was replaced by fact-only profiles (`company_facts_service.py`); see
> REPO_AUDIT_2026-09-20.md. Rendering them on the company page is still open.

**Current state:** `services/api/src/services/company_enrichment_service.py`
and the `company_profiles` table (`migrations/019_company_content_enrichment.sql`,
keyed `company TEXT PRIMARY KEY` — already dedups per company by construction)
exist, but `scripts/enrich_all_content.py` only has `enrich_jobs()` and
`enrich_structured()` — **no `enrich_companies()`, no `--target companies`, no
workflow step calls it.** So there's nothing to "separate" — the coupling the
pasted plan worries about doesn't exist; the feature is just dead code.

**Change** — wire it in:

```python
# scripts/enrich_all_content.py
async def enrich_companies(pool, args) -> dict:
    rows = await pool.fetch(
        """
        SELECT DISTINCT j.company
        FROM jobs j
        LEFT JOIN company_profiles cp ON cp.company = j.company
        WHERE j.is_active = true
          AND (cp.company IS NULL OR cp.enriched_at < now() - interval '90 days')
        LIMIT $1
        """,
        args.limit,
    )
    # for each row: pull sample_titles/locations from jobs, call
    # company_enrichment_service.enrich(), upsert into company_profiles
    ...
```

Add `'companies'` to `--target` choices, add a small daily/weekly step to
`phase-b-structured-backfill.yml` (or its own workflow, offset in time so it
doesn't share a Groq-call window with the other two) — company count is much
smaller than job count, so this can run infrequently at a modest limit.

---

## 4. Middleware 410 check — the real inefficiency isn't the round trip, it's per-instance caching

**Current state:** `lib/goneJobs.ts` already does almost what the pasted plan
asks for — a 5-minute TTL, 5,000-entry in-memory cache, fails open on any
error. The audit's "needs a decision" note undersold it. The actual gap: the
cache is **keyed per job ID** and lives in one serverless/edge function
instance's memory. On Vercel, instances are ephemeral and there are many of
them, so the *same* job gets a fresh `/api/jobs/{id}/status` call from every
cold instance that serves it — the per-ID cache doesn't amortize across the
fleet the way a shared list would.

**Change** — replace the per-ID lookup with one shared list, refreshed on
a timer, checked in memory with zero request-time API calls in the common
case:

1. New API endpoint, `GET /api/jobs/gone-ids?since_days=30` (internal-key
   gated, same pattern as the rest of `internalApi.ts`) returning
   `{"ids": ["<16-hex>", ...]}` for jobs deactivated in the last N days —
   bounded by `is_active = false AND last_seen_at > now() - interval '30 days'`
   so the list can't grow unbounded.
2. `lib/goneJobs.ts`: replace the per-ID `cache: Map<string, {gone, expires}>`
   with a single `let goneSet: {ids: Set<string>; expires: number} | null`,
   refreshed lazily (same lazy-fetch-on-miss shape it already has) every
   10 minutes; `isJobGone(id)` becomes `goneSet?.ids.has(id) ?? false` after
   the refresh, with the existing 1.5s-timeout, fail-open fetch guarding the
   refresh itself.
3. Net effect: **one API call per instance per 10 minutes**, covering every
   job, instead of one call per unique job ID per instance per 5 minutes.

This is additive and low-risk — same fail-open contract, same call sites
(`middleware.ts:59`), just a different cache shape underneath.

---

## 5. `datePosted` — the column exists, the API just doesn't return it

**Current state, verified:** `migrations/016_fix_jobs_created_at.sql` adds
`created_at` idempotently (`ADD COLUMN IF NOT EXISTS`) and backfills any nulls
from `last_seen_at`/`posted_at`, so it's safe to assume the column exists in
production once that migration has run (confirm with `\d jobs` or `SELECT
created_at FROM jobs LIMIT 1` before deploying this, per the audit's own
caution). The real gap: `JOB_COLUMNS` in `services/api/src/routes/jobs.py:12`
does **not** include `created_at` — the API never sends it, so the frontend
has never had access to it regardless of what's in the DB.

**Change:**
1. `jobs.py:12` — add `created_at` to `JOB_COLUMNS`.
2. `apps/web/lib/jobs.ts` — add `created_at?: string` to the `Job` type.
3. `apps/web/lib/structuredData.ts:289`:
   ```ts
   const datePosted = job.posted_at || job.created_at || job.last_seen_at;
   ```
4. Same fallback order in `lib/sitemapJobs.ts`'s `lastmod` calls (currently
   `posted_at`-only by design, per the comment at line ~150 — that comment's
   reasoning, "don't let a non-content field move lastmod," still holds for
   `last_seen_at` but not for `created_at`, which is a real creation
   timestamp; worth extending the fallback there too).

---

## 6. `addressCountry` — needs real data before writing the mapping table

**Current state:** `structuredData.ts:327,336,349` all do
`job.country || 'IN'` — defaults to India whenever `country` is falsy, and
passes through whatever *is* there (including non-countries like `'Europe'`
or a city name) unchanged.

**I can't write a correct normalization table from the repo alone** — it
needs the actual distinct values in production:

```sql
SELECT country, count(*) FROM jobs WHERE country IS NOT NULL GROUP BY country ORDER BY 2 DESC;
```

Once you have that (should be a few dozen distinct values, not thousands),
the shape is:

```ts
// lib/seo/geo.ts
const CITY_TO_COUNTRY: Record<string, string> = {
  // populated from the real distinct-values query, e.g.:
  // 'Amsterdam': 'Netherlands', 'Bengaluru': 'India', ...
};
const NON_COUNTRIES = new Set(['Europe', 'Remote', 'APAC', ...]); // from the same query

export function normalizeCountry(raw?: string | null): string | undefined {
  if (!raw) return undefined;
  const clean = raw.trim();
  if (NON_COUNTRIES.has(clean)) return undefined;
  if (CITY_TO_COUNTRY[clean]) return CITY_TO_COUNTRY[clean];
  return clean; // assume it's already a real country name
}
```

Then `structuredData.ts` changes from `job.country || 'IN'` to
`normalizeCountry(job.country) ?? (isIndianJob ? 'IN' : undefined)` —
omitting `addressCountry` entirely rather than defaulting to India for a
non-Indian job with unrecognized location data, per the audit's own rule
("don't guess a country when the data doesn't establish one").

This is the one item in this plan I'd want the query output for before
writing the actual map — everything else here I can implement straight away.

---

## 7. Genuine per-locale content — the real scope

**Current state:** `i18n/dictionaries/*.json` translate UI chrome only (12
top-level keys: `nav, hero, flow, features, categories, cta, blog, footer,
common, meta, dashboard, leetcode` — verified by reading `en.json`). No job
field is ever translated. `middleware.ts` strips the locale prefix and
rewrites to the *same* route, so `/es/jobs/foo` and `/jobs/foo` render
identical job content with a different nav. `structuredData.ts`'s
`languageAlternates()` emits a static 9-locale hreflang set for every page
regardless of whether that locale has anything different to show — which is
exactly why removing hreflang from job pages was the audit's Stage-3 call.

**Translating all ~15K jobs × 9 locales live is not the right architecture** —
it's slow, expensive, and quality on 9 languages is hard to maintain. Scope
it to the jobs that matter for ranking:

**Design:**
1. New table, keyed by job + locale:
   ```sql
   CREATE TABLE job_translations (
       job_id TEXT NOT NULL REFERENCES jobs(id),
       locale TEXT NOT NULL,
       title TEXT,
       overview TEXT,
       structured_description JSONB,
       model TEXT,
       translated_at TIMESTAMP,
       PRIMARY KEY (job_id, locale)
   );
   ```
2. **Gate translation on the same freshness/quality tier as the sitemap**
   (Section 1) — translate only jobs that are sitemap-eligible, since those
   are the only ones meant to rank. This turns "15K × 9" into "however many
   jobs are in the 0-30-day tier × however many locales you pick" — a much
   smaller, steady-state number.
3. A scheduled worker (same SSH-into-EC2 pattern as `job-content-enrichment.yml`)
   translates `enriched_overview`/`title`/`structured_description` per
   locale, upserts into `job_translations`. Only translate content that's
   already been through content enrichment (`enriched_overview IS NOT NULL`)
   — never machine-translate raw, unvetted scraped text.
4. **`languageAlternates()` becomes job-aware for job-detail pages**: instead
   of the static 9-locale map, a job page only advertises hreflang for
   locales that actually have a `job_translations` row for that job. Locales
   without a translation keep canonicalizing to English (today's safe
   behavior) instead of advertising a URL that's really just English chrome.
5. Job-detail rendering (`JobDetail.tsx` / the page component) reads
   `x-locale` (already set by middleware) and, if a `job_translations` row
   exists for that locale, renders the translated title/overview/structured
   fields in place of the English ones; otherwise falls back to English
   content under the English canonical, same as now.
6. **Fix `<html lang="en">`** (`app/layout.tsx:190`) independently of
   translation completeness — it's a one-line fix and doesn't need to wait
   on the translation pipeline:
   ```tsx
   import { headers } from 'next/headers';
   // ...
   const locale = headers().get('x-locale') || 'en';
   return (<html lang={locale}>...);
   ```

**Decision needed before building this:** which locales are actually worth
the ongoing translation cost. 9 is what's configured; it isn't necessarily
what's worth maintaining. Cheapest starting point: pick 2-3 (`es` and `pt`
are the largest non-English job-market languages by typical search volume;
`ja`/`ko`/`hi` are narrower fits for an India-focused platform) and prove the
pipeline before scaling to all 9.

---

## Build order

1. **Sitemap tiers (§1)** + **structured-enrichment ORDER BY (§2)** — small,
   isolated, no schema change, ship together.
2. **`created_at` in `JOB_COLUMNS` + `datePosted` fallback (§5)** — after
   you've confirmed the column is live in production.
3. **`addressCountry` normalization (§6)** — after you run the distinct-values
   query and send back the real list.
4. **Company enrichment wiring (§4→3 renumber: company enrichment §3)** —
   independent, can land anytime.
5. **Gone-IDs endpoint + shared-cache middleware (§4)** — independent,
   moderate size (one new API route + one file rewrite).
6. **Locale content pipeline (§7)** — largest item, do last, and only once
   you've decided the locale list.

I can start on 1–2 right now — they're pure code changes with tests already
in place to extend. Say the word and I'll implement, test, and hand you a
diff the same way the last drop worked.

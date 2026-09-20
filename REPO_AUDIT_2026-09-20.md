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
   `content-enrichment.yml` (the 10-minute default would kill a 300-row run
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

















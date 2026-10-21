# TODO / Backlog

Everything still open, replacing `seo-remaining-items.md` and the "Not implemented"
half of `Project_Status.md` (both removed — see `CHANGELOG.md` for history). Items
resolved by a later session than the one that first flagged them have been dropped
here rather than carried forward stale; see `CHANGELOG.md` if you want to check one.

---

## Needs a decision from you (not a coding task)

- **Locale scope.** `i18n/config.ts` has 9 locales configured. `es` and `pt` already
  have a real per-job translation pipeline (migration `024_job_translations.sql`); the
  other 7 (`ja`, `fr`, `de`, `ko`, `it`, `hi`, + whichever is missing) don't, and their
  job-detail pages stay `Disallow`ed in `robots.txt` on purpose. Decide whether any of
  those 7 are worth a real translation pipeline or should be dropped from
  `i18n/config.ts` entirely — translating and maintaining all 9 without real content
  behind 7 of them isn't a good use of effort.
- **Monetization scripts, not evaluated.** `nap5k.com` push tag (4 list pages),
  `n6wxm.com` interstitial (internship detail pages), `3nbf4.com` push service worker
  (`public/sw.js`) are still in place. Flagged as a plausible page-experience/quality
  drag worth A/B testing off — your revenue trade-off to make, not a bug.
- **Blog chart content — one-off or format?** Is the ML-engineer article a prototype
  for more pieces like it, or a one-off? Blocks the item below.

## Blocked on real job-listings data (only matters if the above is "more like it")

- Chart data pipeline (skill frequency, experience distribution, salary ranges, tech
  clusters, location/work-arrangement distribution) — charts currently render nothing
  rather than fake numbers, which is correct, just incomplete.
- Sample-size + "last updated" trust line (e.g. "Based on 1,248 listings") and sourcing
  every stat/claim to a method + sample size.
- Topic-cluster linking across ML/AI/MLOps/resume content — an editorial call once the
  format question above is settled.

## Real features, not fixes

- `interactiveFilters` / `dataExplorer` — a live filtering UI backed by the jobs API.
  Static markup would be worse than omitting it, so this is genuinely unbuilt, not
  faked.
- Direct company career-page scrapers for Google, Amazon, Microsoft, Apple, Uber, Meta,
  Nvidia — `company_portals.py` has the pattern (tech_mahindra/tcs/etc.) but isn't
  extended to these.
- More ATS providers (Phase 2 scope): Workday CXS, iCIMS, SuccessFactors, Zoho Recruit,
  Keka, Darwinbox, Eightfold, Comeet, Hibob, Zwayam — each needs more involved auth than
  the public-JSON pattern the current adapters use.
- More board scrapers: Wellfound, Bayt, Glassdoor, HackerNews "Who's Hiring" — each has
  its own markup quirks, deferred.
- `company_portals.py`, `unstop.py`, `cutshort.py` — still fragile per-selector scraping
  against JS-heavy SPAs. Needs a structural rebuild against each site's API/GraphQL, not
  more selector patching.
- Liveness/legitimacy verifier for dorker-discovered boards — before a dorker-found
  board is treated as fully trusted, it should clear `quality.py` at a higher bar than
  hand-curated boards. Not built yet.
- `crawler/` (`services/api/crawler`) still has no automated test harness (unlike
  `services/company_intel`, which has 19 passing tests) — `boto3`/`psycopg2` import at
  module load time makes it heavier to stub. Worth adding at some point.

## Needs live access (can't be resolved from a repo checkout)

- **Confirm OG images actually resolve** — `curl -sI` a job OG image
  (`/og/<id>.png`) and a company one (`/og/company/<slug>.png`); expect `200` +
  `image/png`. Generated and wired in, never hit live.
- **Board-slug / tenant verification** — the SmartRecruiters/Workday/Ashby slugs added
  across sessions 7, 10 and 15 are plausible guesses, not confirmed against the real
  sites (no general internet access in the build sandbox). Run `probe_boards.py
  workday smartrecruiters` on EC2 and correct any 404s against each company's real
  careers page. Accenture/Cognizant/Infosys/TCS/Zoho/Deloitte/EY mostly run custom
  portals, so expect several of these to need a dedicated scraper instead.
- **Mobile — real device pass.** Session 8's grid-overflow fix was verified in headless
  Chromium with worst-case data, never on a real phone. Also unresolved from that
  session: 34 `text-[9-11px]` usages (legibility risk) and `min-h-screen` on listing
  pages. Worth a Lighthouse + real-device pass on `/jobs`, `/internships`, a job detail
  page, `/companies`, `/skills`.
- **Phase E — re-verify GSC reports after re-crawl.** Needs production to have been
  live with the sitemap/indexing fixes for 2–3 weeks first.
- **Indexation-health monitoring** — Search Console tracking of indexed/duplicate/
  soft-404 counts over time. A GSC/monitoring setup, not something to build in this
  repo.

## Operational steps (code is already in place, just needs configuring)

- `GOOGLE_INDEXING_SERVICE_ACCOUNT_JSON` not confirmed set — Phase F's Google Indexing
  API leg degrades gracefully to IndexNow-only without it, so this is silent unless you
  check for it.
- `INTERNAL_API_KEY` not confirmed set on both the API host and Vercel — the SSR
  rate-limit exemption is inert (not broken) without it.

## Already correctly deferred — no action needed, listed so it isn't re-flagged

- **hreflang** (site-wide list-page alternates) — intentionally gated off
  (`HREFLANG_ENABLED = false`) until more locales have real translations, not an
  oversight.
- **FAQ schema on company pages** — intentionally removed in Session 14. Google limits
  FAQ rich results to authoritative gov/health sites, it isn't a ranking factor, and
  copying a company's own Q&A adds little unique content. `faqSchema()` itself is
  unaffected and still used by jobs/skills/tools/blog pages.
- **`quality_score` thresholds** (50 for 31–90d jobs, 75 for 90d+) are still explicitly
  placeholders, not validated against a real production distribution. Not wrong, just
  unconfirmed — worth a look once there's enough `quality_score` data to check the
  split against actual engagement.

---

## Manual SEO QA checklist

Needs the live site, can't be checked from a repo diff. Replaces `SEO_CHECKLIST.md`.
Replace `<path>` with a real URL, e.g. `/companies/<slug>` or `/jobs/<slug>`.

1. **Redirect & status**: `curl -sIL www.intern-flow.in/<path>` → 301 to
   `https://intern-flow.in/<path>`, then 200.
2. **View source** (Ctrl+U), check:
   - `<title>`: one, under ~60 chars, contains the job title and company.
   - `meta name="description"`: one, 120–160 chars.
   - `rel="canonical"`: apex URL, same path.
   - `meta name="robots"`: absent on indexable pages, `noindex, follow` on thin ones.
   - `<h1>`: exactly one, and its flattened text content reads correctly (no
     missing-whitespace artifacts like the homepage H1 bug fixed on 2026-10-22 — worth
     spot-checking other hero/heading components for the same pattern).
   - `application/ld+json`: job page → JobPosting + BreadcrumbList + FAQPage; company
     page → BreadcrumbList + Organization, no FAQPage.
   - FAQ answers appear as normal text in the HTML, not only after a click.
3. **Network tab** (Disable cache, reload): document 200; `/og/<id>.png` or
   `/og/company/<slug>.png` is 200 `image/png`; no red requests; no 4xx/5xx to the API
   host; large JS bundles aren't blocking first paint.
4. **Rendered text check**: view source must contain the responsibilities/prep/FAQ
   text — if it's only in the Elements panel, it's client-rendered and search engines
   may miss it.
5. **Mobile**: Chrome DevTools device mode; the Apply button is visible without
   scrolling.
6. **Google Rich Results Test**: job page shows "Job posting" valid with no errors; FAQ
   shows as detected.
7. **Search Console**: URL Inspection → "URL is on Google" or request indexing; Pages
   report for "Page with redirect" / "Discovered, not indexed" counts week over week;
   Sitemaps report shows the sitemap index as Success.
8. **PageSpeed Insights** (mobile): LCP, CLS, INP on one job page and one company page.

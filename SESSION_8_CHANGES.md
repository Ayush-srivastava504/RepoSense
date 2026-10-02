# Session 8 — phases 3d, 7, 8, 5

Tests: `cd services/api && PYTHONPATH=src pytest tests` -> 113 passed (103 before; +6 gov gate, +4 registry).

## 3d. Government quality gate — DONE (hybrid scope; flip if you disagree)
Problem: `assess_legitimacy` scores on compensation + description length, which a government notice never has,
so every govt job was `uncertain` + `is_thin` -> never in the sitemap.
- `crawler/src/processors/quality.py`: `assess_government_legitimacy`, `classify_government_relevance`.
  verified = (official .gov/.nic domain OR 2+ sources) + advt no. + last date; likely = 2+ of
  {advt no., real department, vacancies, last date}; else uncertain. 3+ structured fields => not thin.
- Scope = hybrid: `tech_psu` (engineer/scientist/IT titles, or PSU/research org + trainee/officer title) can reach
  verified/`full`; `general` is capped at quality 60 and `standard` content, so it ranks below and drops out of the
  old (>90d) sitemap tier but is NOT excluded. Tech/PSU-only = make `general` return `rejected` in filter_and_score.
- `content_layer.py`: general govt never gets tier `full`. No migration (relevance is in-memory + legitimacy_reasons).
- Tests: `tests/test_government_gate.py`.

## 7. Chained pipeline + central logging — DONE
- `daily-pipeline.yml`: enrich -> sitemap -> index (jobs, internships, remote, government, sequential) -> gone.
  Sitemap runs even if enrich fails; index/gone are skipped if sitemap fails; one category failing doesn't stop the next.
  `indexnow-submit-gone.mjs` is now actually called (stage `gone`).
- Old crons removed from `job-content-enrichment.yml` and `category-daily-index.yml` (manual dispatch kept).
  Hourly `build-sitemaps.yml` kept for freshness. Crawler stays a 20-min loop.
- Migration `029_pipeline_runs.sql`; `scripts/pipeline_stage.py` wraps a stage and logs it; crawler logs `crawl` rows
  (`log_pipeline_run` in crawler/src/utils.py). Logging failures never fail a stage.
- Latest status per stage:
  `SELECT DISTINCT ON (stage) stage, status, started_at, duration_s FROM pipeline_runs ORDER BY stage, started_at DESC;`

## 8. sitemap_categories registry — DONE
- Migration `030_sitemap_categories.sql` (seeds 4 job categories + 10 route sitemaps).
- `sitemap_builder.rebuild` reads it (falls back to all-enabled if the table is missing); `GET /api/sitemap/categories`;
  web `app/sitemap.xml/route.ts` builds the index from it, with the old hardcoded list as fallback.
- Toggle without deploy: `UPDATE sitemap_categories SET enabled=false WHERE slug='government-jobs';`

## 5. Mobile audit — static pass only (no device/Lighthouse available here)
Fixed: 6 listing-page search inputs were 14px (iOS Safari zooms on focus) -> `text-base sm:text-sm`; `.shell` now uses `100dvh`.
Already fine: viewport meta (no zoom lock), tables in `overflow-x-auto`, app shell nav buttons 44px, sidebar dvh.
Not changed, needs a real Lighthouse/device run: 34 `text-[9-11px]` usages (legibility), `min-h-screen` on listing pages.

## Deploy order
1. Run migrations 029, 030. 2. Deploy API + crawler containers. 3. Deploy web. 4. Re-run the daily pipeline manually (dispatch).

## 5b. Mobile horizontal overflow on /dashboard (from your screenshots) — FIXED
Cause: `.container-xl` (used by AppShell's `<main>` and the Footer) has `margin: 0 auto` and sits inside the flex-column
`.main-column`. Auto margins stop a flex item from stretching, so the box shrank to its content width; the long
unbreakable guest id in the greeting made it wider than the phone, so the button, cards, step boxes and footer text all ran off the right edge.
Fix: `width: 100%; box-sizing: border-box` on `.container-xl` (globals.css), `[overflow-wrap:anywhere]` on the dashboard h1,
and guests are greeted as "there" instead of their generated `guest-<hash>` id (dashboard/page.tsx).
Not verified in a browser here; check /dashboard on your phone after deploy.

## 5c. Mobile horizontal overflow on every page (jobs, internships, remote, government, companies, skills, ...) — FIXED
5b fixed the shell width; the content inside it still overflowed on phones. Two causes, both app-wide:
1. `grid gap-3 sm:grid-cols-3` (and ~40 more like it) has no column template below `sm`, so the browser builds one `auto`
   column that grows to the widest item's min-content. One long unbroken string (URL, email, scraped title, "A/B/C/D" location)
   widened the whole grid past the screen.
2. Long unbreakable strings in chips, titles, company links, descriptions (`whitespace-pre-line`) and tables had nothing allowing them to wrap.

Fix (all in `app/globals.css` unless noted, so every page inherits it):
- `.grid { grid-template-columns: minmax(0, 1fr) }` in `@layer base` = one shrinkable column on phones. Every `grid-cols-*` utility still overrides it.
- `.container-xl { overflow-wrap: anywhere }` (inherited by all page content and the footer); `.container-xl table` stays `normal`.
- `.chip` gets `max-width: 100%; min-width: 0`; `.panel` gets `min-width: 0`.
- `JobFactsTable`: `table-fixed` + wrapping cells (long URLs in the facts table were clipped).
- `JobCard` footer row: `flex-wrap` and `min-w-0` on the price column. Side fix: in 3-up card grids at ~1024px (FeaturedJobs / Similar jobs) the
  "Apply now" button used to stick out of the card; it now drops to its own line.

Verified in headless Chromium (not on a real device) using the real AppShell, JobCard, JobDetail, filters, cards, FactGrid, footer
and the real Tailwind build, with worst-case data (long unspaced titles, locations, URLs, emails): 458 overflowing elements -> 0 at
320/360/390/430px (widest page was 1519px on a 360px screen, now 360px). With realistic data, element positions at 768/1280/1536px
are identical before/after; the only intended difference is the card footer wrap at ~1024px.
Still worth a quick look on a real phone: /jobs, /internships, a job detail page, /companies, /skills.

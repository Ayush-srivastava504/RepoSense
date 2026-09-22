# Changes in this pass

All changes are in `services/api/crawler/src/` unless noted. Every file
below was `python3 -m py_compile`'d after editing, and the new logic
(quality gate, internshala fix, enrichment ordering/honesty) was dry-run
against representative inputs — see inline comments for the reasoning.

## 1. Quality gate (new) — `processors/quality.py`
Ported from FresherFlow's `legitimacy-detector.service.ts` +
`extractor.ts`'s `isRejectedApplyUrl`/`isListingUrl`. Previously RepoSense
had no quality gate at all: anything scraped flowed straight to the DB.

- Hard-rejects postings whose apply URL is a homepage, search/listing
  page, blog/article, govt portal, or aggregator redirect — these never
  reach `upsert_jobs` now.
- Everything that survives gets a deterministic `legitimacy_state`
  (`verified` / `likely` / `uncertain`), `is_thin` flag, and
  `quality_score` (0-100), instead of being treated as equally
  trustworthy by default.
- Wired into `index.py` right after `score_batch` (trust scoring), before
  the DB write. Pipeline summary now reports `quality_rejected` and
  `quality_thin_flagged` counts.

New migration: `services/api/database/migrations/020_job_quality_gate.sql`
adds `legitimacy_state`, `legitimacy_reasons`, `quality_score`, `is_thin`
columns + a partial index for "thinnest active jobs first" queries.
`utils.py`'s `upsert_jobs` now persists these columns (verified the
INSERT column list, %s placeholder count, and tuple length all match at
29 via AST parsing, not just by eye).

## 2. Content enrichment throughput + honesty — `content_enrichment.py`
- **Priority order**: was first-N-in-scrape-order; now sorts
  thinnest-description-first (quality_score as tiebreak) so a capped
  batch always spends its budget where it matters.
- **Honest counts**: `ai_enriched` and `template_fallback` are now
  reported separately instead of both counting as "enriched" — you can
  now tell from the summary whether a run produced real AI overviews or
  copies of the same boilerplate paragraph.
- **Cap**: raised the default per-run `BATCH_LIMIT` from 60 to 250
  (still env-overridable via `CONTENT_ENRICHMENT_BATCH_LIMIT`) — 60/run +
  100/day cron against an 8,000+ backlog could mathematically never catch
  up.
- **Warning log**: fires when an entire run falls back to template
  content, so a missing/broken API key stops failing silently.
- **`.github/workflows/content-enrichment.yml`**: fixed a real bug in the
  ops comment — it told operators to set `XAI_API_KEY`, but the code only
  ever reads `GROQ_API_KEY`. A box with only `XAI_API_KEY` set would
  silently run 100% template-fallback enrichment with no error. Comment
  now says `GROQ_API_KEY`.

## 3. Internshala keyword bug — `scrapers/internshala.py`
The old code joined the top-3 keywords into one string
(`"internship fresher graduate trainee"`) and searched that as a single
garbled query, which is why this should-be-best source returned only 13
results. Now browses the main unfiltered feed directly (highest yield)
plus each keyword separately as a secondary, narrower pass.

## 4. Ashby / SmartRecruiters board lists — `config.py`
Swapped the old list (several dead/irrelevant boards — `openai`,
`vanta`, `McDonalds`, `Adidas`...) for companies more plausibly running
intern/new-grad pipelines. **Not live-verified** — my sandbox has no
general internet access (only package registries + GitHub), so I could
not confirm these board slugs resolve. Flagged in-code as a stopgap:
any hardcoded board list rots as companies switch ATS providers. The
real fix is dynamic board discovery (see FresherFlow's `dorker.ts`) —
worth porting as a follow-up rather than re-patching this list again.

## 5. Active liveness checking — `utils.py`, `index.py`
`deactivate_stale_jobs()` only fires at 30+ days of no re-crawl — far too
slow for postings that often close within days. Added
`check_liveness_for_aging_jobs()`: HEAD-checks a batch of active jobs
aged 2-14 days and deactivates any whose apply link now 404s/410s. Wired
into `index.py` right after the existing 30-day sweep; `deactivated`
in the pipeline summary is now the sum of both.

## 6. Structured job details (new) — matches FresherFlow's Education / Key Skills / Requirements / Notes breakdown
Previously, RepoSense's job page only rendered the raw scraped `description` blob
plus a one-paragraph AI overview. FresherFlow's detail page (see the John Crane
"Trade Apprentice" example) shows separate Education, Key Skills, and Notes
sections extracted into structured fields. Ported that pipeline:

- **Migration**: `services/api/database/migrations/021_structured_job_details.sql`
  adds `allowed_degrees`, `allowed_courses`, `allowed_specializations`,
  `allowed_passout_years`, `required_skills`, `notes_highlights`, `work_mode`,
  `experience_min/max`, `job_function`, `structured_description`.
- **New module**: `services/api/crawler/src/structured_enrichment.py` — ported
  from FresherFlow's `enricher.ts`/`enricher-schema.ts`. Has a Groq LLM path
  (system prompt requiring strict JSON matching the schema above) and a
  rule-based fallback (regex/keyword extraction, ported from
  `enrichJobRuleBased`) for when no API key is set, so structured fields still
  populate — just less richly — without an LLM. Verified the column names in
  the migration match the `UPDATE jobs SET ...` statement's field names
  programmatically (diffed, not eyeballed), and dry-ran the rule-based path
  against a "Trade Apprentice at John Crane"-style description — correcly
  extracted Diploma/12th degree levels, ITI course, and Fitter/Machine
  Operation/Maintenance skills with no network access.
- **Wired into `index.py`** as its own pass after `run_content_enrichment_for_new_jobs`,
  intentionally kept separate from the already-tested overview/keywords Groq
  call so a bug here can't take down that path. Summary now reports
  `structured_enrichment`.
- **Frontend**: `apps/web/lib/jobs.ts`'s `Job` type gets the new optional
  fields; new `apps/web/app/components/StructuredDetails.tsx` renders the
  Education/Key Skills/Notes panel (returns `null` — renders nothing — when a
  job hasn't been through structured enrichment yet); `JobDetail.tsx` now uses
  `structured_description` in place of the raw `description` when available.
  Syntax/transpile-checked with the TypeScript compiler (not full type-checked
  against the app's own tsconfig/React types — that would need a full
  `npm install` of the Next.js app, which wasn't run this pass).

## Not done / explicitly out of scope this pass
- `company_portals.py`, `unstop.py`, `cutshort.py`: still fragile
  per-selector scraping against JS-heavy SPAs. Not patched — flagged as
  needing a structural rebuild (likely against each site's underlying
  API/GraphQL, if one exists) rather than more selector chasing.
- `hiringcafe.py`: multi-strategy fallback (API → browser intercept →
  `__NEXT_DATA__` → HTML heuristic) looks structurally sound, but I
  could not verify hiring.cafe's current response shape live (blocked by
  sandbox network policy). Worth a manual check against the live site.
- FresherFlow-side changes: not touched. This pass only ported patterns
  *from* FresherFlow *into* RepoSense; nothing in the FresherFlow repo
  itself was modified.

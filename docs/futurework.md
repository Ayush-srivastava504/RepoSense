# readmework.md — RepoSense (InternFlow) Build Charter

**Status:** living document. Every future session (Claude or human) reads this
file *first*, updates the **Session Log** at the bottom *last*, and never
skips a phase gate to "go faster."

This file exists because 12 new feature areas are queued up (listed in
Part D) and each one is genuinely large. The failure mode this document is
built to prevent is: an AI assistant skims the request, invents plausible-
sounding file paths / API shapes / SEO tactics that *aren't actually in this
codebase*, writes a pile of code against that imagined foundation, and
nothing works because the foundation was fiction. Part A and Part B are the
antidote — they are the **actually-verified, as-of-this-audit** state of the
repo. Part C is the reusable checklist that makes every future scraper,
route, or page a citizen of the existing system instead of a bolt-on
island. Part D is the phase plan for the 12 requested features.

---

## Part A — Ground Truth: what this repo actually is right now

> Everything in this section was confirmed by reading the files directly
> (not recalled from a template). If a future session needs to check
> whether something described here is still true, the file path is given —
> **re-open it, don't assume.**

### A.1 — Monorepo shape

```
RepoSense-master/
├── apps/web/                       Next.js 14 App Router, TS, Tailwind, i18n (9 locales)
├── services/
│   ├── app.py                      convenience launcher
│   └── api/
│       ├── src/                    Core FastAPI app — THIS is "the backend"
│       │   ├── core/app.py         create_application() — entry point
│       │   ├── routes/             one router module per domain (auth, jobs, resume, linkedin, ...)
│       │   ├── services/           business logic, one file per concern
│       │   ├── schemas/            pydantic models
│       │   ├── configs/            db.py, redis.py, settings.py, config.py, ml_config.py
│       │   ├── middleware/         auth.py, rate_limit.py
│       │   └── utils/              logger.py, crypto.py, model_downloader.py
│       ├── database/migrations/    001_users.sql … 022_priority_index_push.sql (see A.5)
│       ├── crawler/                batch job, NOT a persistent server — see A.3
│       ├── rag/                    RAG microservice (README generation), port 8001
│       └── neural_generator/       local Qwen3-0.6B GGUF via llama-cpp-python, port 8002
├── infrastructure/docker/          docker-compose.yml
├── scripts/                        generate-daily-posts.mjs, indexnow-submit.mjs
├── docs/                           Overview.md, SETUP_GUIDE.md, DEPLOYMENT_GUIDE.md, MODEL_CONFIGURATION.md
├── tests/                          root pytest suite (currently thin — test_basic.py only)
├── PHASE_PLAN.md                   the *existing* phase-tracking doc for jobs/SEO/filters work — read it, don't duplicate it
└── INDEXING_RECOVERY_PLAN.md       GSC-driven indexing audit — read before touching sitemaps/robots/metadata
```

**Never invent a `packages/` workspace, a root `package.json` workspace file,
a root `database/` folder, or a `railway.json`/Terraform config — none of
these exist. `docs/Overview.md` says so explicitly; it was correcting
stale docs that used to claim otherwise. Don't reintroduce that drift.**

### A.2 — The four backend processes, and where code review lives

Read `docs/Overview.md` §Architecture before assuming a fifth service
exists. There are exactly four:

1. **Core API** (`services/api/src`, port 8000) — auth, jobs, resume,
   LinkedIn optimizer, subscriptions (Razorpay, not Stripe), webhooks,
   async-job polling, **and** code review/auto-fix/self-healing
   (`analysis_engine.py`, `auto_fixer.py`, `validation_engine.py` —
   these run *inside* the Core API process, they are not a separate
   service, despite what a first skim of the folder names might suggest).
2. **Crawler** (`services/api/crawler`) — CLI batch job
   (`python src/index.py --scrapers ... --max-pages ...`), not an HTTP
   server. Writes directly to Postgres. This is where every job scraper
   lives — see A.3, and Part C for the contract any new scraper must meet.
3. **RAG** (`services/api/rag`, port 8001) — FAISS + sentence-transformers,
   retrieves code chunks, feeds them to the Neural Generator.
4. **Neural Generator** (`services/api/neural_generator`, port 8002) —
   local, quantized **Qwen3-0.6B GGUF** via `llama-cpp-python`, CPU-only.
   Used today for README generation, resume content, LinkedIn suggestions.
   **This is the "Qwen-powered" engine feature #11 (resume builder) asks
   for — it already exists. Reuse it; do not add a second LLM stack.**

### A.3 — The scraper contract (read before writing ANY new scraper)

File: `services/api/crawler/src/scrapers/base.py`

- Every scraper is a class extending `BaseScraper` (ABC), setting
  `source_name` and `uses_browser`, and implementing
  `scrape(keywords, locations, max_pages) -> List[Dict]`.
- `BaseScraper.run()` (not `scrape()`) is the entry point the pipeline
  calls: it manages the Playwright browser lifecycle, catches and logs
  exceptions per-scraper (**one scraper crashing never takes down the
  whole crawl run** — this pattern must be preserved by any new scraper),
  and stamps `source`, `scraped_at`, and a deterministic `id`
  (`make_job_id(title, company, source, apply_url)`) onto every result.
- `new_page()` / `goto()` are the only sanctioned ways to get a Playwright
  page — they set nav timeouts and a real user agent. Don't hand-roll a
  new browser context.
- After `scrape()` returns raw dicts, the pipeline (see `index.py`) always
  runs them through, in this order: **normalizer → dedupe → trust →
  quality → structured_enrichment/content_enrichment** —
  `services/api/crawler/src/processors/`. A new scraper's job is to
  produce `_empty_job()`-shaped dicts; it must **not** reimplement
  dedupe/trust/quality itself.
- Registration is two edits, not one: add the scraper to
  `ENABLED_SCRAPERS` in `config.py` **and** to the `_load_scrapers()`
  registry in `index.py`. A scraper only in one of the two is dead code —
  grep both before declaring a new scraper "wired in."
- ATS adapters (public JSON/XML, no login) follow `ats_common.py`'s shared
  pattern — see `recruitee.py`/`teamtailor.py`/`bamboohr.py` etc. for the
  reference shape. Discovery-style scrapers (no fixed company list) follow
  `dorker.py`'s pattern of Bing-dork queries against known ATS URL
  templates, tagging `source='dorker'` so discovered jobs are
  distinguishable from hand-curated lists.
- `PHASE_PLAN.md` Phase 2 item 6 already flags that **dorker-discovered
  boards need a stricter quality-gate bar than hand-curated ones, since
  there's no human review step** — any new discovery-style scraper
  inherits that same requirement, don't skip it because it "worked in
  local testing."

### A.4 — The SEO system (read before touching ANY public page)

This repo already runs a real, tested programmatic-SEO pipeline. A new
feature that's public-facing (walk-in jobs, GET jobs, course verifier
results, HR finder, etc.) **is not "done" until it plugs into this system**
the same way `/skills/[slug]`, `/jobs-in/[city]`, and `/batch/[year]` do.
The mechanisms, concretely:

| Concern | File | What it does |
|---|---|---|
| SERP-accurate title truncation | `apps/web/lib/seo/seoMetrics.ts` | `truncateTitleForSerp()` — pixel-width budget (580px), not a character count. `truncateDescription()` — 158-char word-boundary cutoff. `buildJobTitle()` builds the canonical `<title>` shape. `isStaleForIndexing()` — noindex once a listing is past its deadline or 45 days stale with no deadline. |
| Thin/near-duplicate hub gating | `apps/web/lib/seo/hubThresholds.ts` | `SKILL_MIN_JOBS=5`, `LOCATION_MIN_JOBS=3`, `BATCH_MIN_JOBS=3`. Below threshold → **soft gate**: `robots: {index:false, follow:true}` in `generateMetadata`, and the URL is dropped from its sitemap — never a hard 404, because these hubs carry real evergreen content (FAQs, related links) beyond the live listing grid. |
| OG images | `apps/web/lib/seo/ogImage.ts` | `jobOgImageUrl()` — per-entity branded 1200×630 card via `next/og`, cached (`Cache-Control: public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800`), generic branded fallback for unknown IDs (never a broken image or 404). |
| Structured data | `apps/web/lib/structuredData.ts` | `jobPostingSchema()`, breadcrumb schema. |
| Breadcrumbs | `Breadcrumbs.tsx` + `breadcrumbSchema()` | wired on every hub page — **do not hand-roll a second breadcrumb `<nav>`**; `CHANGES_THIS_SESSION.md` records a whole cleanup pass for exactly that duplication bug. |
| Sitemaps | `apps/web/app/sitemap-*.xml` (one file per surface: jobs, skills, locations, batches, careers, resume, tools, blog, companies, hackathons, static) + `sitemap.xml` as the index | Every new indexable surface needs its **own** sitemap entry, added to the index, and excluded when below its hub threshold. |
| robots.txt / crawler headers | `apps/web/public/robots.txt`, `middleware.ts` `NOINDEX_PREFIXES` | AI-scraper bots (GPTBot, CCBot, Bytespider, ClaudeBot, etc.) are explicitly disallowed in their own `User-agent` blocks — **new routes don't need special-casing here unless they're an auth-only or genuinely non-public surface** (see the `/login`,`/register` vs `/resume`,`/ats-checker` precedent in `PHASE_PLAN.md` Phase 2 item 7 — the deciding question is "does `AuthGuard` admit guests, and is there unique indexable content here," not "is it behind a login screen at all"). |
| hreflang / i18n | `apps/web/i18n/dictionaries/`, `languageAlternates()` | 9 locales. `PHASE_PLAN.md` Phase 3 item 5 confirms `alternates.languages` is keyed off the **canonical path only**, never `searchParams` — new query-param filters never need a hreflang audit, only new *paths* do. |
| Facets / filters | `apps/web/lib/facets.ts`, `routes/jobs.py` `GET /api/jobs/facets` | server-side `GROUP BY`/`unnest()` counts, scoped by the base search but **not** by the advanced filters themselves (so each dropdown's own counts don't collapse to its own selection). Any new filterable dimension (e.g. GET-job branch, walk-in date) should extend this endpoint, not build a parallel one. |

**The single most important rule from this table:** before adding a new
public hub/route, open `apps/web/app/skills/[skill]/page.tsx` (or
`app/batch/[year]/page.tsx`, the most recently-added hub) and match its
shape — `generateMetadata`, threshold gate, breadcrumbs, FAQ schema,
related-links — rather than designing a new page shape from scratch.

### A.5 — Database migrations

Latest migration on disk (verified by listing
`services/api/database/migrations/`): **`022_priority_index_push.sql`**.
**The next migration for any new feature starts at `023_*.sql`.** Before
writing one:
- Read `docs/Overview.md`'s migration table for what 001–012 already
  cover (users, resumes, jobs, subscriptions, repo_docs, OTP auth, async
  jobs, LinkedIn optimizer, job trust/ranking, guest users) so a new
  migration doesn't recreate a table that already exists under a
  different name.
- Run `python services/api/run_migrations.py` after adding one, and
  confirm it's idempotent (safe to re-run) the way the existing ones are.
- `make migrate` in the root `Makefile` is **stale** (only runs 001–004) —
  don't trust it as a completeness check.

### A.6 — Testing reality (do not claim more coverage than exists)

- Root: `tests/test_basic.py` (thin). `services/api/test_imports.py`
  validates that backend imports resolve.
- `services/api/tests/` has grown since — e.g.
  `test_jobs_facets.py` (9 tests, mocked DB pool, asserts SQL/param shape
  and response shape — **not** live query results against a real DB).
  Follow that pattern for new endpoint tests: mock the pool, assert the
  query shape and the response contract, don't require a live Postgres in
  CI unless the repo's CI config already provisions one — check
  `.github/workflows/` before assuming otherwise.
- `docs/Overview.md` explicitly lists test files that **used to be
  documented but do not exist** (`test_api.py`, `test_ml.py`,
  `test_analysis.py`, `test_self_healing_pipeline.py`,
  `test_performance.py`, `validate_system.py`). This is the exact failure
  mode this whole document exists to prevent — a stale doc asserting
  coverage that was never real. **Every phase gate below requires that
  new tests are added in the same PR as the feature, not promised for
  later.**
- k6 load tests: `load-test.js` at repo root, `services/api/loadtest/`.

### A.7 — Auth, payments, models (so new features don't reinvent them)

- Auth: email OTP (Resend) + guest JWT sessions + optional GitHub OAuth
  (Fernet-encrypted tokens). **No passwords anywhere in this system.** A
  new feature needing "login" reuses this — it does not add a password
  field or a new OAuth-token storage pattern without Fernet encryption
  matching `utils/crypto.py`.
- Payments: **Razorpay**, migrated off Stripe in migration `007`. Never
  reintroduce Stripe-specific code paths.
- Subscription gating pattern: `subscription_service.py` (tier-based) and
  `linkedin_service.py` (tier **plus** a rewarded-ad-credit unlock path —
  `FREE_LIFETIME_LIMIT`, `linkedin_ad_credits` table). Any new
  freemium-gated feature (course verifier? HR finder lookups?) should
  reuse one of these two access patterns rather than inventing a third.
- LLM access: `ai_service.py` (general), `resume_ai_service.py`
  (resume-specific), `linkedin_ai_service.py` (LinkedIn-specific) all
  route through the Neural Generator (§A.2) and/or configured external
  providers (`ANTHROPIC_API_KEY`, `GROQ_API_KEY` — both optional per the
  root `README.md`'s env block). New AI-flavored features (course
  verifier, resume improver, quiz generation) plug into this layer, not a
  new direct API client.

---

## Part B — The anti-hallucination operating protocol

This is binding on every future session, regardless of which feature is
being built.

### B.1 — Before writing a line of code

1. **Grep before you guess.** If you're about to write "the jobs table has
   a `salary` column" or "the scraper base class has a `parse()` method,"
   go verify it with `view`/`grep` in *this* checkout first. A plausible
   guess that happens to be wrong is worse than admitting you haven't
   checked yet — it compounds into follow-on code that also doesn't work.
2. **State assumptions explicitly, then verify them**, don't silently
   assume. If a feature requires something not yet in the repo (e.g. "an
   LLM prompt library for SEO enrichment"), say so plainly, and either
   build the minimal missing piece or flag it as a dependency — never
   write code that calls a function/route/table that doesn't exist yet
   and describe it as done.
3. **Re-read Part A.3/A.4 for every scraper or public-page change** — they
   are the contract, not a suggestion. A scraper that skips the
   normalizer/dedupe/trust/quality pipeline, or a hub page that skips the
   threshold gate, is not "a faster version" of the pattern — it's a bug
   that will surface as duplicate/thin/unindexed content weeks later.

### B.2 — While writing code

4. **Match the existing style exactly** — this codebase's Python favors
   dense one-line class-attribute dicts and explicit docstring "why"
   comments over inline logic explanation (see `hubThresholds.ts`'s
   comment block, or `_freshness_conditions()`'s docstring, as the house
   style). Don't introduce a different formatting convention in new files.
5. **Extend, don't fork.** New filterable dimensions extend
   `GET /api/jobs/facets` and `filterJobs.ts`'s semantics; new scrapers
   extend the crawler pipeline; new AI calls extend the existing service
   layer. A parallel, from-scratch implementation of something this repo
   already solved is a maintenance liability and a strong signal that the
   existing code wasn't actually read.
6. **No fabricated data, ever.** Company lists, board URL patterns, email
   deliverability rules, course-quality rubrics — anything presented as
   fact must come from a real, checkable source (existing code, official
   docs, a citation). The existing `ATS_COMPANIES`/`GENERIC_BOARDS` lists
   in `config.py` already carry an explicit code comment admitting they
   are "best-effort, not live-verified" — that honesty is the standard to
   match, not a bar to quietly drop.

### B.3 — Before calling a phase "done"

7. **Tests exist and pass**, in the same change, for the new
   routes/services/scrapers/components — not "should be tested later."
   Follow the `test_jobs_facets.py` shape (mocked pool, asserted SQL/
   response contract) for backend; add a Playwright/RTL-equivalent smoke
   test for new frontend surfaces if the repo already has a pattern for
   that (check `apps/web` for existing frontend test config before
   assuming one exists or inventing a new one).
8. **The SEO checklist in Part C is walked item-by-item** for any public
   surface, and the phase's entry in Part D's tracker is updated with
   what was actually verified (not a copy-paste of what was planned).
9. **A short "what I actually checked" note is left in the phase's
   session log entry** — file paths read, commands run, tests executed.
   This is what lets the *next* session trust the previous one instead of
   re-deriving everything from scratch (exactly how `PHASE_PLAN.md` and
   `CHANGES_THIS_SESSION.md` already work for the jobs/SEO track — this
   document's Session Log at the bottom is the equivalent for the 12
   features in Part D).

---

## Part C — The "New Surface" checklist

**Use this for literally any addition**: a new scraper, a new public page,
a new API route, or a new AI-generated content type. It is the concrete,
step-by-step version of Part A.4 turned into a to-do list, so that "SEO,
prompt strategy, and architecture" isn't something re-derived from vibes
each time — it's a checklist that gets walked and checked off.

### C.1 — If it's a new scraper (source of new listings/entities)

- [ ] Extends `BaseScraper`, implements `scrape()` only, relies on
      `run()`/`new_page()`/`goto()` for lifecycle (A.3).
- [ ] Returns `_empty_job()`-shaped dicts (or the closest existing shape
      for the entity type — e.g. a hackathon scraper matches
      `scrapers/hackathons/base.py`'s shape, not the jobs shape).
- [ ] Registered in **both** `config.py` `ENABLED_SCRAPERS` **and**
      `index.py`'s `_load_scrapers()`.
- [ ] Goes through normalizer → dedupe → trust → quality →
      structured/content enrichment — no bypassing.
- [ ] If discovery-based (no fixed source list): tagged with its own
      `source` value, and quality-gated *more* strictly than curated
      sources, per A.3's dorker precedent.
- [ ] Any hardcoded company/board list ships with the same "best-effort,
      not live-verified" honesty as `ATS_COMPANIES` — don't imply
      certainty the code doesn't have.
- [ ] Unit test asserting the scraper's output dicts match the expected
      shape (mocked HTTP/Playwright response → asserted parsed fields).

### C.2 — If it's a new public page/hub (SEO-facing)

- [ ] Modeled directly on `app/skills/[skill]/page.tsx` or
      `app/batch/[year]/page.tsx` (the two most recently-hardened hub
      patterns) — `generateMetadata`, canonical, hreflang alternates.
- [ ] `truncateTitleForSerp()` / `truncateDescription()` used for
      `<title>`/meta description — no raw character-count truncation.
- [ ] A minimum-content threshold defined (or explicitly reasoned as
      unnecessary — e.g. a page with real evergreen content regardless of
      live-entity count doesn't need one) — if it does, added to
      `hubThresholds.ts` and applied as the same soft
      `robots:{index:false,follow:true}` gate, never a hard 404.
- [ ] `jobPostingSchema()`-equivalent structured data for the entity type
      (or the closest matching Schema.org type — `Course` for course
      verifier results, `JobPosting` for GET/walk-in jobs, etc.)
- [ ] Breadcrumbs via the shared `Breadcrumbs.tsx` + `breadcrumbSchema()`
      — never a second hand-rolled breadcrumb `<nav>`.
- [ ] OG image: either reuse `jobOgImageUrl()`'s pattern for a new entity
      type, or confirm the page inherits a sensible non-generic fallback —
      never leave it silently inheriting the root layout's default image
      (that was the exact bug Phase 3 item 3 found and fixed).
- [ ] New sitemap file (`sitemap-<surface>.xml`), added to `sitemap.xml`'s
      index, excludes anything below its own threshold gate.
- [ ] Internally linked from somewhere real (footer, nav, or
      `ExploreRelated.tsx`-style contextual links) — a sitemap-only page
      with zero internal links is the same failure mode Phase 3 item 1
      explicitly avoided for `/batch/[year]`.
- [ ] robots.txt / `NOINDEX_PREFIXES` decision made deliberately (public
      tool landing page → indexable; pure auth-flow with no unique
      content → noindexed) — using the `/login` vs `/resume` precedent in
      A.4, not a blanket rule.

### C.3 — If it's a new AI-generated content type (course scores, resume
rewrites, quiz questions, HLD/LLD explanations)

- [ ] Routes through the existing AI service layer (`ai_service.py` /
      feature-specific sibling) and the Neural Generator, **not** a new,
      separate LLM client — unless the task genuinely needs a capability
      the local Qwen3-0.6B model can't provide, in which case that's
      stated explicitly as a new dependency, not silently assumed away.
- [ ] The prompt itself is written to **refuse to fabricate** — i.e. the
      prompt instructs the model to say "insufficient data" / return a
      lower confidence score rather than inventing a course rating, an HR
      contact's title, or a code metric it wasn't given. This mirrors the
      house style already visible in `hubThresholds.ts`/`config.py`'s
      comments: state uncertainty honestly instead of presenting a guess
      as fact.
- [ ] Output is validated/sanitized server-side before being shown or
      stored (schema-checked JSON, not free text trusted as-is) — same
      spirit as `validation_engine.py`'s existing role in the code-review
      pipeline.
- [ ] If the content is public and indexable (e.g. a course-verifier
      results page), it also goes through the C.2 checklist in full.

---

## Part D — Phase plan for the 12 requested features

Each feature below gets: what already exists to build on (verified, not
assumed), the new pieces needed, its migration number, and its **phase
gate** — the condition that must be true (tests included) before the next
phase starts. **Build in the order given** — later features deliberately
reuse infrastructure earlier ones establish, so building out of order
means re-doing work.

Numbering below follows the migration sequence starting at `023` (A.5).
Feature order is grouped by dependency, not by the order in the original
request list.

### D.0 — Foundational note on scope honesty

Two of the twelve requested items are **exact duplicates** as written
(#6 and #7 are both "Email Verifier" with identical copy). Part D treats
this as **one** feature (D.6) and flags the duplication rather than
silently building it twice or silently guessing a second, different
feature was intended. If a second, distinct feature was meant, that needs
to come from the user, not an invented guess.

---

### D.1 — Email Verifier (foundational — HR Finder depends on it)

**Migration:** `023_email_verifier.sql`

**What exists already:** `services/api/src/services/email_service.py`
(currently used for OTP delivery via Resend — read it first to see if any
domain/MX-check logic already lives there before writing new logic).

**New pieces:**
- Service: format validation (RFC-5322-reasonable regex, not a
  by-hand overengineered one), DNS **MX record** lookup for the domain,
  and a deliverability heuristic (SMTP handshake probe *without* sending
  mail, catch-all domain detection) — categorizing into
  **Valid / Invalid / Risky / Unknown** exactly as specified.
- Route: `POST /api/email-verifier/check` (single) and
  `POST /api/email-verifier/bulk` (batch, rate-limited via the existing
  `middleware/rate_limit.py`).
- Table: `email_verification_cache` (email, status, checked_at, ttl) —
  a domain's MX record doesn't change every request; cache to avoid
  hammering DNS on repeat lookups (mirrors the caching intent already
  visible in the OG-image `Cache-Control` pattern in A.4).
- Frontend: a small tool page under `/tools` (this repo already has a
  "suite of free AI tools" pattern per the root README's route table) — 
  reuse that pattern, don't invent a new top-level nav section for one
  tool.

**Phase gate:** unit tests cover all four categories with mocked DNS
responses (no live network calls in CI); the bulk endpoint is rate-limited
and tested for the limit; the tool page is added to `sitemap-tools.xml`
per C.2 (this is a genuinely useful indexable tool landing page, same
category as `/ats-checker`).

---

### D.2 — HR Finder (depends on D.1)

**Migration:** `024_hr_finder.sql`

**What exists already:** `company_enrichment_service.py`,
`structured_enrichment_service.py` — read both; HR Finder is fundamentally
a company-enrichment feature and may extend these rather than starting
fresh.

**New pieces:**
- Service: given a company name, discover **publicly available**
  recruiter/HR names (public LinkedIn search results, company "about"/
  "team" pages — **no login-walled scraping, no LinkedIn Easy-Apply-style
  session automation here** — this is a distinct, lower-risk lookup, not
  the D.10 Sequencer). Generate likely email patterns
  (`firstname@company.com`, `f.lastname@company.com`, etc. — a small,
  explicit, documented list of patterns, not an invented "AI guesses the
  format" black box) and verify each candidate through **D.1's** email
  verifier before showing anything to the user.
- Filters: company / role / location / hiring area — extend the facets
  pattern from A.4's table (`facets.ts` + a `GET /api/hr-finder/facets`
  analog) rather than inventing a separate filter mechanism.
- Table: `hr_contacts` (company, name, title, location, source_url,
  generated_email, verification_status, discovered_at).
- **Explicit non-goal:** this feature does not scrape or store private/
  login-walled profile data. If a data source requires authentication to
  access, it's out of scope for this feature, not a "we'll figure out
  auth later."

**Phase gate:** every contact shown to a user has a `verification_status`
that traces back to a real D.1 check (never "assumed valid"); tests cover
the pattern-generation logic against a fixture set of known company
formats; the filter endpoint has the same mocked-pool test shape as
`test_jobs_facets.py`.

---

### D.3 — Course Quality Verifier & Detector

**Migration:** `025_course_verifier.sql`

**What exists already:** the AI service layer (A.7) and
`processors/quality.py` (the jobs pipeline's own quality-scoring
processor) — the course verifier's scoring logic should follow the same
*spirit* (transparent, itemized scoring, not a single opaque "AI says 7/10")
even though courses aren't jobs and need their own processor module.

**New pieces:**
- New processor: `services/api/src/services/course_quality_service.py` —
  itemized score across curriculum depth, instructor background
  (public credentials only), review-sentiment signal, certification
  legitimacy, and career-relevance match against the existing
  `SKILL_ALIASES`/skill-hub data this repo already maintains
  (`config.py`'s `SKILL_ALIASES`, `apps/web/app/skills/data.ts`) — reuse
  that taxonomy rather than inventing a second skills list.
- AI prompt (per C.3): must return a structured score **with per-criterion
  justification quoting what was actually found**, and must explicitly
  flag "insufficient public information to assess X" rather than
  fabricating a rating for a criterion it has no data for.
- Route + table: `POST /api/course-verifier/check`,
  `courses` / `course_quality_reports` tables.
- Frontend: results page follows C.2 in full if these reports are meant to
  be publicly indexable (e.g. "is [Course Name] legit?" search-intent
  pages) — confirm with the product intent before building the SEO layer,
  since a *private*, user-specific check doesn't need one.

**Phase gate:** the scoring output schema is validated server-side before
storage/display (C.3); a fixture set of known-good and known-scammy course
listings produces sane relative scores in tests; if public pages are built,
the full C.2 checklist is checked off explicitly in this phase's session
log entry.

---

### D.4 — Walk-in Jobs section

**Migration:** `026_walkin_jobs.sql`

**What exists already:** the entire jobs pipeline (A.3, A.4) already
supports a `type` column and category-specific routes/hubs
(`/remote-jobs`, `/government-jobs` per the root README's route table).
Walk-in jobs are a **category of the existing `jobs` table**, not a new
entity type.

**New pieces:**
- Add `'walkin'` as a valid `type` value (or a boolean/enum column if
  walk-ins need fields the current schema doesn't have — e.g. a specific
  walk-in date/time-window and venue address — check `003_jobs.sql` and
  `021_structured_job_details.sql` first to see what's already there
  before adding new columns that duplicate existing ones like
  `location`).
- Scraper coverage: walk-in drives are typically posted on the same
  boards this repo already scrapes (`freejobalert.py`,
  `employment_news.py`, company portals) — check whether the existing
  scrapers already surface walk-in postings mislabeled as regular jobs
  before writing a *new* scraper; likely this is a normalizer/tagging
  change (detect "walk-in" keywords + venue/date fields at enrichment
  time), not a new source.
- Route: extend `GET /api/jobs/` with a `category=walkin` filter (same
  pattern as `is_government`/`is_remote` flags already in `JOB_COLUMNS`)
  — do not create a parallel `/api/walkin-jobs/` router.
- Frontend: `/walkin-jobs` page, modeled on `/government-jobs/page.tsx`
  exactly (C.2), including its own `sitemap-walkin-jobs.xml`.

**Phase gate:** confirm via a real query against a local/staging DB (or a
representative fixture) that existing scraped data already contains
walk-in postings before claiming "no new scraper needed"; C.2 checklist
complete for the new hub; tests cover the new filter param the same way
`test_jobs_facets.py` covers existing ones.

---

### D.5 — Post-a-Job section (employer-submitted listings)

**Migration:** `027_employer_job_postings.sql`

**What exists already:** the jobs table/pipeline (A.3), auth (A.7),
subscription gating pattern (A.7) for a potential "paid featured listing"
tier later — don't build monetization now unless asked, but don't design
the schema in a way that blocks it either.

**New pieces:**
- Table: `employer_job_postings` (submitter user_id, company, title,
  description, moderation_status enum: `pending/approved/rejected`,
  submitted_at, reviewed_at) — **kept separate from the scraped `jobs`
  table until approved**, then inserted into `jobs` with
  `source='employer_direct'` on approval, so the existing trust/quality/
  SEO pipeline (A.3, A.4) treats it identically to a scraped listing once
  it's live — no special-cased rendering path for employer-submitted
  jobs.
- Route: `POST /api/employer-jobs/submit` (auth required — reuse OTP/
  guest session, A.7), `GET/POST /api/employer-jobs/moderation` (admin-
  only — check whether an admin-role concept already exists in `users`
  schema before inventing a new one).
- **A moderation step is non-negotiable** — unmoderated public job
  submission is a spam/abuse vector; this is not optional scope-cutting.
- Frontend: submission form (no SEO surface needed for the form itself —
  it's behind auth, `robots: noindex` per the A.4 `/login`-precedent
  logic) + the approved listing is just a normal job detail page once it
  flows into `jobs`.

**Phase gate:** an unapproved submission never appears in `/api/jobs/`,
any sitemap, or any hub page — tested explicitly, not just assumed from
the `moderation_status` column existing; moderation route is admin-gated
and tested for the gate.

---

### D.6 — Graduate Engineer Training (GET) jobs hub

**Migration:** `028_get_jobs.sql`

**Same pattern as D.4** (category, not new entity) but with its own filter
dimensions: skill, location, branch (engineering discipline — check
whether a `branch`/`department` column already exists per
`021_structured_job_details.sql` before adding a duplicate), salary,
experience level.

**New pieces:**
- `job_group='get'` or equivalent tag at enrichment time — likely a
  keyword-based classifier at the same pipeline stage as
  `processors/enricher.py`, tagging postings whose title/description
  match GET/Engineering-Trainee patterns.
- Frontend hub `/graduate-engineer-training`, modeled on
  `/skills/[skill]/page.tsx` combined with the existing advanced-filter
  bar (`AdvancedJobFilters.tsx`) rather than a bespoke filter UI.
- `sitemap-get-jobs.xml`, threshold-gated per `hubThresholds.ts` (define
  a `GET_JOBS_MIN_JOBS` constant alongside the existing three).

**Phase gate:** classifier precision spot-checked against a labeled
fixture set (not just "looks right on a few examples"); full C.2
checklist.

---

### D.7 — HLD & LLD Shorts

**Migration:** `029_system_design_shorts.sql`

**What exists already:** the LeetCode judge / Blind-75 tracker (per root
README) is the closest existing analog — a bank of structured
question+solution content with progress tracking. Read
`leetcode_service.py` and `schemas/leetcode.py` before designing this
feature's schema; HLD/LLD Shorts is likely "the LeetCode content model,
short-form-scrollable UI, system-design domain" rather than a from-scratch
design.

**New pieces:**
- Table: `system_design_questions` (topic, prompt, solution_markdown,
  difficulty, related_patterns) + `user_system_design_progress` (mirrors
  whatever shape `leetcode` progress tracking already uses — reuse it).
- Route: `GET /api/system-design/feed` (paginated/cursor-based, since it's
  a scroll feed, not a classic paged list), `POST /api/system-design/
  attempt`.
- AI angle (per C.3, optional): if solutions are AI-assisted rather than
  fully human-authored, the same "state uncertainty, cite what a design
  pattern actually requires, don't fabricate a real-world system's
  internals" prompting discipline applies as in D.3.
- Frontend: scrollable card feed component; **this is content, so it is
  genuinely SEO-relevant** — individual question pages should get the
  full C.2 treatment (they're evergreen, high-search-intent content, the
  same category as the existing `/careers/[role]` deep-dive pages) even
  though the primary in-app experience is a scroll feed.

**Phase gate:** progress-tracking table reuses the leetcode pattern
verifiably (cite the actual file(s) matched against); individual
question detail pages pass C.2 if built as indexable routes.

---

### D.8 — Quizzes

**Migration:** `030_quizzes.sql`

**Note:** this chat surface already has a `quiz_display_v0` **UI
rendering tool** available to Claude in conversation — that is a
different thing from a persisted, in-product quiz feature with its own
question bank, and should not be confused with it. This phase is about
the **product feature** (a quiz bank users can take inside InternFlow),
not the chat-tool widget.

**What exists already:** same LeetCode/system-design content-model
precedent as D.7 — reuse the same question/attempt/progress table shape
rather than a third bespoke one.

**New pieces:**
- Table: `quizzes`, `quiz_questions`, `quiz_attempts` — generic enough to
  back both general dev-skill quizzes and (optionally, later) course
  quizzes for D.3's course-verifier flow, and HLD/LLD quizzes for D.7 — 
  **build one quiz engine, not three feature-specific ones.**
- Route: `GET /api/quizzes/`, `GET /api/quizzes/{id}`,
  `POST /api/quizzes/{id}/attempt`.
- Frontend: quiz-taking UI; quiz index/detail pages are indexable content
  (C.2) if they're general-knowledge/skill quizzes meant to attract
  search traffic, same category reasoning as D.7.

**Phase gate:** confirm during design that D.7 and D.8 are sharing the
*same* underlying tables/engine, not duplicating one — this is exactly
the "extend, don't fork" rule from B.2 item 5, applied concretely.

---

### D.9 — AI Resume Builder & Improver (Qwen-powered)

**Migration:** likely none new, or a small additive one —
`002_resumes.sql` already exists; check its columns before assuming new
ones are needed.

**What exists already — this is the single biggest "don't rebuild, reuse"
item in the whole plan:** `resume_service.py`, `resume_ai_service.py`,
`resume_template_service.py`, `resume_pdf_service.py` (LaTeX compilation,
per root README), `ats_rules.py`, and the Qwen3-0.6B Neural Generator
(A.2). The root README already describes almost exactly this feature:
*"Contextual resume scoring... aligns bullet points with target job
descriptions... compiles pixel-perfect PDF resumes using LaTeX"* and
*"targeted improvements without unnecessarily rewriting the entire resume,
while preserving the user's original information and structure."*

**New pieces (the actual gap, if any — verify by reading
`resume_ai_service.py` in full first):**
- A selection UI/API letting the user pick *which* dimension to improve
  (ATS score / skills / experience / projects / formatting / job-specific
  tailoring) as **independent toggles**, if the existing service doesn't
  already expose this granularity — check before building it, this may
  already exist as an option in `resume_ai_service.py`'s request schema.
- Drag-and-drop upload UI, if not already present in the resume-builder
  frontend route.

**Phase gate:** an explicit statement in the session log of exactly what,
if anything, was net-new here versus what was discovered to already
exist — this phase has the highest risk of a future session claiming to
"build" something that's substantially already built, which is precisely
the hallucination pattern this whole document exists to prevent.

---

### D.10 — LinkedIn OAuth + CV upload + Sequencer (Easy Apply automation) + Application Tracker

**Migration:** extends `010_linkedin_optimizer.sql`'s table family; new
migration for the sequencer/tracker: `031_application_sequencer.sql`.

**This is the highest-risk item in the list and must be treated that
way, not built enthusiastically on the first pass:**

- **LinkedIn does not offer a public "Easy Apply" API.** There is no
  documented, ToS-compliant way to programmatically submit LinkedIn Easy
  Apply applications on a user's behalf via official OAuth scopes.
  `config.py` already has `LINKEDIN_EMAIL`/`LINKEDIN_PASSWORD` env vars
  and `linkedin.py` in the crawler uses Playwright-based session
  automation for *scraping* job listings — that precedent is for reading
  public listings, not for submitting applications through a logged-in
  session, which is a materially different (and materially riskier,
  ToS-wise) action: it risks the end user's LinkedIn account being
  flagged/restricted, and it's the kind of automated-account-action
  request this system should not build without that risk being surfaced
  to the user explicitly, every time, not buried in a settings page.
- **What this phase actually builds, concretely and honestly:**
  1. LinkedIn OAuth (`Sign in with LinkedIn`, the real, official,
     ToS-compliant OAuth flow) for **identity/profile import only** —
     matching the existing GitHub OAuth pattern in A.7 (Fernet-encrypted
     token storage, same `auth.py` shape).
  2. CV upload — reuses the existing resume upload path (D.9's
     services), not a new upload pipeline.
  3. Job-type preference selection — a simple preferences form, backed by
     a new `user_job_preferences` table.
  4. **The "Sequencer" auto-apply mechanism itself is scoped, at most, to
     matching the user against already-scraped LinkedIn listings in the
     existing `jobs` table (source='linkedin') and one-click-opening the
     real LinkedIn apply URL for the user to complete themselves** —
     i.e., a curated, pre-filled shortlist and a "your matches" queue,
     not unattended automated submission through the user's authenticated
     session. If genuine unattended auto-submission is still wanted after
     reading this, that decision — and its account-risk tradeoff — needs
     to be made explicitly by the product owner, in writing, before any
     session automation code is built, not assumed as the default
     interpretation of "Sequencer."
  5. Application tracker: a Kanban-style table
     (`application_tracker_entries`: job_id, user_id, status enum
     [`saved`,`applied`,`interviewing`,`offer`,`rejected`], notes,
     updated_at) — this part is straightforward CRUD and low-risk,
     reusing D.4/D.6-style job-category tagging for "what kind of job is
     this" display context.

**Phase gate:** the account-automation risk tradeoff in bullet 4 above has
been explicitly surfaced and a decision recorded in the session log
**before** any Playwright-driven submission code is written — this gate
cannot be satisfied by silently building the riskier interpretation and
mentioning it in passing.

---

### D.11 — Notes app for developers

**Migration:** `032_dev_notes.sql`

**What exists already:** the in-browser xterm.js terminal + GitHub sync
(per root README) is the closest existing "developer workspace" surface —
check whether a notes/scratchpad concept already has a natural home
attached to that terminal experience before building a fully separate
top-level app section.

**New pieces:**
- Table: `dev_notes` (user_id, title, body_markdown, tags, linked_repo
  [optional FK/reference to whatever the GitHub connection already
  stores], created_at, updated_at).
- Route: standard CRUD (`GET/POST/PUT/DELETE /api/notes/...`), auth-gated
  (A.7).
- Frontend: markdown editor + list view. **This is a private, per-user
  feature — it gets `robots: noindex` per the A.4 `/login`-precedent
  logic, no sitemap entry, and does not need the C.2 checklist.** Don't
  spend SEO effort here; it doesn't apply.

**Phase gate:** basic CRUD tests; confirmed noindex on any note-related
route that's server-rendered.

---

## Part E — Cross-cutting build order (why this sequence)

1. **D.1 Email Verifier** — no dependencies, small, immediately reusable.
2. **D.2 HR Finder** — depends on D.1.
3. **D.9 AI Resume Builder** — mostly *auditing* existing code, cheap to
   do early, de-risks D.10 (which needs the CV-upload path).
4. **D.4 Walk-in Jobs**, **D.6 GET Jobs** — same underlying jobs-pipeline
   pattern; doing them back-to-back means the second one reuses lessons
   from the first's threshold/sitemap/classifier work.
5. **D.5 Post-a-Job** — needs the jobs pipeline patterns fresh from step 4.
6. **D.3 Course Verifier** — independent, but benefits from D.1's "verify,
   don't fabricate" prompting discipline being fresh.
7. **D.7 HLD/LLD Shorts** then **D.8 Quizzes** — build the shared
   content-engine tables once, in this order, then reuse for quizzes.
8. **D.11 Notes app** — simple, low-risk, good "breather" phase before D.10.
9. **D.10 LinkedIn Sequencer** — last, deliberately: highest risk, and
   everything it needs (OAuth pattern, resume upload, jobs pipeline,
   tracker CRUD pattern) has already been proven out in earlier phases.

Do not reorder this without a stated reason in the session log — the
ordering exists to de-risk the hardest item (D.10) by having every
sub-pattern it needs already validated elsewhere first.

---

## Part F — Session Log

Append one entry per work session. Never edit a previous entry except to
correct a factual error (and note the correction). This is the append-only
audit trail that makes Part B.3's "trust the previous session" possible.

### Template

```
### YYYY-MM-DD — <phase worked on>
**Verified before starting:** <file paths actually opened/greped>
**Built:** <what was actually written, file by file>
**Tests:** <what was run, pass/fail, command used>
**Deviated from plan because:** <if applicable>
**Left for next session:** <explicit, not vague>
```

### 2026-09-16 — Document created

**Verified before starting:** `README.md`, `docs/Overview.md`,
`PHASE_PLAN.md`, `INDEXING_RECOVERY_PLAN.md`,
`services/api/crawler/src/scrapers/base.py`,
`services/api/crawler/src/config.py`,
`apps/web/lib/seo/hubThresholds.ts`, `apps/web/lib/seo/seoMetrics.ts`,
`services/api/src/services/linkedin_service.py`,
`services/api/src/routes/jobs.py`, full listing of
`services/api/database/migrations/` (confirmed latest is `022`), full
directory listing of `services/api/src/services/` and
`services/api/crawler/src/scrapers/`.
**Built:** this document only — no feature code yet.
**Tests:** none run (no code changed).
**Left for next session:** start Part E step 1 (D.1 Email Verifier).
Before writing code, re-open `services/api/src/services/email_service.py`
in full (it was referenced here but not read line-by-line) to confirm
whether any MX/domain-check logic already exists there, and check
`.github/workflows/` for the actual CI DB setup before assuming the
mocked-pool test pattern is the only option.

# Session 10 — Phase 4 SEO fixes + company logo fix

Tests: web 95 passed (92 + 3 logo), `tsc --noEmit` clean. Backend change syntax-checked only (pytest not installed in sandbox).

## Structured data (apps/web/lib/structuredData.ts)
- `jobPostingSchema` returns null when required location fields can't be stated truthfully
  (remote + unresolvable country; on-site + no location + no resolvable country). Callers render the script only when non-null.
- `eventSchema` returns null without `startDate`, or offline with no location/country.
- New `companyOrganizationSchema` (website/logo only for verified official domains), used on /companies/[company].

## Duplicate meta / thin pages
- /companies/[company]: paginated pages get "— Page N" in title + description.
- `COMPANY_MIN_JOBS = 2` + `companyIsThin()` in lib/seo/hubThresholds.ts: noindex when < 2 jobs and no enriched profile.
  sitemap-companies.xml drops companies under the threshold.

## Company logos
- `lib/logoDomain.ts`: job boards / ATS hosts / social domains are never used for a logo -> letter avatar.
- `CompanyLogo.tsx`: also falls back to the letter when the image is < 32px (Google's placeholder globe).
- `services/api/src/routes/companies.py`: logo_domain aggregation skips non-employer domains, prefers official + most recent.
- JobPosting `hiringOrganization` logo/sameAs use the same filter.

## Not done (needs live access / decisions)
- OG image check: `curl -sI https://intern-flow.in/og/blog/machine-learning-engineer-job-market-skills-salary-2026.png` (expect 200 + image/png).
- Company lookup is capped at 200 per tier (getCompanyBySlug / sitemap) -> needs a by-slug API.

## Company intelligence crawler — services/company_intel/ (NEW, separate from the job crawler)
- Migration `033_company_intel.sql`: `company_entities`, `company_sources`, `company_topics`.
- Package `company_intel/`: `domains`, `topics` (10 topics), `fetcher` (robots.txt, rate limit, off-site redirect guard),
  `extract`, `grounding` (prompt + validation: ungrounded numbers/names/fluff are rejected), `llm` (Groq -> Gemini -> NVIDIA via
  llm_providers.py), `db`, `pipeline` (seed/crawl/enrich), `run` (CLI). Dockerfile, requirements, README, 12 tests (pass).
- API: `GET /api/companies/by-slug/{slug}` (entity + published topics + live job count) and `GET /api/companies/intel/sitemap`.
- Web: `getCompanyIntel`, `CompanyTopics` component, company page shows topics (boilerplate intro only when there are none),
  meta description from the overview topic, entities resolve past the 200-company cap, sitemap includes intel-only companies,
  index gate = 5+ published topics OR 2+ jobs OR profile.
- Workflow `.github/workflows/company-intel.yml` (weekly + manual). Its host paths/env file are assumptions - see the file header.

## Run order
1. Deploy migration 033 + API. 2. `python -m company_intel.run seed` 3. `crawl --limit 5 --only <slug>` on one company and read
`company_sources`. 4. `enrich --only <slug> --dry-run`, then without `--dry-run`. 5. Open `/companies/<slug>`.

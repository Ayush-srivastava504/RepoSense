# Session 15: company intel fix, company-page 500, new companies/roles

## 1. Company intel (services/company_intel)
- BUG: `pipeline._store_wikidata` still passed 7 args to `UPSERT_SOURCE_SQL` (6 params since the FAQ removal in session 14).
  asyncpg raises on that, so every `crawl` died on the first company while Wikidata was enabled. Fixed + regression test.
- `run.py`: a failure on one company is logged and skipped instead of aborting the batch (crawl and enrich).
- New `manual_companies.py` + `seed_manual()` (runs at the end of `seed`): curated employers with verified official domains
  (TCS, Infosys, Wipro, HCLTech, Tech Mahindra, Cognizant, Capgemini, Accenture, GlobalLogic, LTIMindtree, Deloitte, EY, KPMG,
  PwC, Zoho, Zeta, Caterpillar, ...). `domain_source='manual'` rows are never overwritten by job-derived domains.
  Add more by appending `(name, domain)` pairs.

## 2. Company page 500 (`/companies/[company]`)
- API `GET /api/companies/by-slug/{slug}`: normalises bullets/source_urls, tolerates a missing company_intel schema,
  and falls back to the jobs table so any company with live jobs resolves (no more 404/500 for companies outside the top 200).
- API `GET /api/companies/{company}/profile`: bad/missing facts -> 404, not 500.
- Web `lib/companies.ts`: `normalizeIntel` / `normalizeProfile` absorb text-jsonb, null arrays, missing `facts.experience`.
- `CompanyProfilePanel` / `CompanyTopics`: guards for missing arrays, unique keys, invalid dates.
- Page: `generateMetadata` never throws; secondary fetches use `Promise.allSettled`; new `error.tsx` boundary.
- NOTE: I could not reproduce the 500 without your production logs. The fixes above remove every code path I found that
  can throw; if it persists, send the `Digest:` from the Vercel log for one failing URL.

## 3. Crawler
- Keywords: graduate engineer trainee, trainee engineer, associate software engineer, QA analyst/engineer, software tester,
  test engineer, manual/automation testing, SDET, technical trainee.
- Workday queries: + trainee, graduate engineer trainee, associate engineer, qa, test engineer.
- New category `QA & Testing` (title-only match, `processors/enricher.py`), grouped under `software`.
- `ats_candidates.py`: SmartRecruiters slugs and Workday tenants for Capgemini, Cognizant, Accenture, GlobalLogic, Caterpillar,
  KPMG, Deloitte, EY, Zeta, Zoho, Infosys, TCS, Tech Mahindra, ... plus display names. `caterpillar`, `globallogic` added to the top tier.
- UNVERIFIED (no internet in the build sandbox): tenant/site/slug values are best guesses; a wrong one 404s and is skipped.
  Run on EC2: `cd services/api/crawler && python probe_boards.py workday smartrecruiters` and correct from each company's real careers URL.
  Accenture, Cognizant, Infosys, TCS, Zoho, Deloitte and EY mostly run custom portals, so expect some of those to need a dedicated scraper.

## 4. Verification
- `pytest services/company_intel`: 19 passed. `tsc --noEmit`: clean. `tsx --test`: 149/150 (the 1 failure,
  "no file in the repo emits the www host", is pre-existing: it flags docs/UPTIME_AND_SEARCH_CONSOLE.md).
- Not run: API/crawler against a live DB or the real career sites.

## 5. Deploy
1. Push; Vercel builds web. Rebuild/restart API (`docker compose ... build api && up -d api`).
2. `python -m company_intel.run seed` then `crawl --limit 50` then `enrich` (or the company-intel workflow).
3. Probe boards (above), then run the crawler once with `--scrapers workday,smartrecruiters --dry-run`.

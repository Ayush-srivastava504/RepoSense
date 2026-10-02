# Session 14 — remove FAQ groundwork, company-page SEO pass

## 1. FAQ code removed (matches the "intentionally deferred" status)
- `services/company_intel/company_intel/extract.py`: `extract_faq`, FAQ constants, `Page.faq` removed.
- `services/company_intel/company_intel/db.py`: `faq` dropped from `UPSERT_SOURCE_SQL`; `faq_json()` removed.
- `services/company_intel/company_intel/pipeline.py`: both `db.faq_json(...)` arguments removed.
- `services/company_intel/tests/test_company_intel.py`: FAQ test removed (16 tests pass).
- `services/api/src/routes/companies.py`: FAQ query, `MAX_FAQ_PAIRS` and the `faq` field removed from `GET /api/companies/by-slug/{slug}`.
- Migration `034_company_faq.sql` deleted; new `035_drop_company_faq.sql` runs `ALTER TABLE company_sources DROP COLUMN IF EXISTS faq`
  (safe whether or not 034 ever ran; migrations here re-run on every API start, so it is idempotent).
- Web: `CompanyFaq.tsx` deleted; FAQPage JSON-LD and `CompanyFaq` type/field removed from `lib/companies.ts` and `/companies/[company]`.
  `faqSchema()` stays in `lib/structuredData.ts` (still used by jobs, skills, tools, blog pages).
- Docs: `seo-remaining-items.md` and `services/company_intel/README.md` updated.
- Not touched: the `faq` crawl topic in `topics.py` (a model-written text section from the company's own FAQ page, no markup).

## 2. Company page SEO changes (`/companies/[company]`)
- Profile panel + topic sections now render on page 1 only. `?page=N` self-canonicalises, so repeating the same
  long text on every page was duplicate content.
- H1 now reads "<Company> jobs & internships" (was the bare name) to match the title tag.
- Page 1 with topics now shows a visible "N active listings..." line, so the visible copy matches the meta description.
- Intro boilerplate (shown when there are no topics) is page 1 only.

## 3. Audit result: company pages (checked, no change needed)
- Canonical: self-referencing, `?page=N` kept for N>1; host is the apex (`lib/site.ts`), www only 301s to it.
- Title/description: pixel-truncated title, "— Page N" suffix on N>1, description from the overview topic when present.
- Thin pages: `companyIsThin()` -> `robots: noindex, follow`; sitemap only lists companies with >= 2 jobs or >= 5 published topics, so no noindex URL is in the sitemap.
- Out-of-range `?page=N` -> real 404. Pagination is plain `<Link>` anchors (crawlable).
- JSON-LD: BreadcrumbList + Organization (no fake logo, `sameAs` only for verified employer domains).
- OG/Twitter: per-company image at `/og/company/<slug>.png`.
- hreflang: off site-wide (`HREFLANG_ENABLED=false`) by design; `/es/companies/x` canonicalises to the unprefixed URL.
- `/companies` index: canonical, breadcrumb + ItemList JSON-LD, A-Z directory links, sitemap entry.

## 4. Verification run in this session
- `tsc --noEmit`: clean. `tsx --test tests/*.test.ts`: 101/101 pass. `pytest services/company_intel`: 16/16 pass.
- Live checks (curl, view-source, Network tab, GSC) need your deployed site: see the checklist below.

## 5. Deploy (EC2 + Vercel)
1. Push to GitHub. Vercel builds the web app. The backend CI deploys `api` to EC2 (or run step 2 by hand).
2. On EC2: `cd ~/RepoSense && git pull`, then
   `docker compose -f infrastructure/docker/docker-compose.yml build api && docker compose -f infrastructure/docker/docker-compose.yml up -d api`
   (the API entrypoint runs every migration, including 035, on start).
3. Confirm: `docker compose -f infrastructure/docker/docker-compose.yml logs api | grep 035` and
   `psql "$DATABASE_URL" -c "\d company_sources"` (no `faq` column).
4. API: `curl -s https://api.intern-flow.in/api/companies/by-slug/<slug> | python3 -m json.tool | head` (no `faq` key; `topics` present).
5. If you run the company-intel crawler image from EC2, rebuild it too so it stops writing `faq`.

## 6. SEO verification checklist (company + company page)
Use a real slug, e.g. `/companies/<slug>` from sitemap-companies.xml.
- `curl -sI https://intern-flow.in/companies/<slug>` -> 200, no `x-robots-tag: noindex`.
- `curl -sIL www.intern-flow.in/companies/<slug>` -> 301 to the apex URL (https://intern-flow.in/...).
- View-source: one `<title>`, one meta description, `<link rel="canonical">` = the apex URL (https://intern-flow.in/...), one `<h1>`, `og:image` = `/og/company/<slug>.png`.
- View-source: JSON-LD has `BreadcrumbList` and `Organization`, and NO `FAQPage`.
- Page 2 (`?page=2`): canonical keeps `?page=2`, title ends "— Page 2", no topic sections / profile panel in the HTML.
- Thin company: `<meta name="robots" content="noindex, follow">` present and the slug is absent from `/sitemap-companies.xml`.
- Network tab (Disable cache, reload): the document is 200; `/og/company/<slug>.png` returns 200 `image/png`; no failed (red) requests; no 4xx/5xx to `api.intern-flow.in`.
- Sitemap: `curl -s https://intern-flow.in/sitemap-companies.xml | head` -> valid `<urlset>`, apex URLs only.
- Tools: Google Rich Results Test (breadcrumb + organization only), Search Console URL Inspection -> Request indexing for 3-5 company URLs.

## 7. Job detail pages (jobs / internships / remote-jobs / government-jobs `[slug]`, shared `JobDetail`)
- Apply + Save now sit directly under the title block (above the fold); the bottom Apply button stays.
- New sections from `jobs.enriched_sections` (migration 036, `services/job_sections_service.py`): role and responsibilities,
  how to prepare, common mistakes, resume keywords. Every number and ATS keyword is validated against the listing text; failures are
  stored as NULL and retried (no template filler). Jobs not processed yet simply omit those blocks.
- "About <company>" on the job page comes from the company_intel overview topic (grounded, source-linked); omitted when none exists.
- FAQ: answers are always visible (no tap-to-expand). `lib/jobFaq.ts` builds fact-based answers (eligibility, skills, pay, work mode,
  deadline, how to apply) from fields the job really has, plus AI FAQs; the FAQPage JSON-LD uses the same function so markup == visible text.
  Legacy `content_faq` (3 templated Qs) is no longer rendered; table_only tier still gets no FAQ.
- Emoji removed from JobCard and JobTags.
- Listing order (checked, unchanged): /jobs, /internships, /remote-jobs, /government-jobs, /japan-jobs, /europe-jobs all request
  `sort=ranked` (top company +40, posted <24h +35, <72h +20, <7d +8, confidence up to +25).

## 8. Deploy additions
1. API rebuild runs migration 036 (adds `enriched_sections`). 2. Generate sections (inside the api container):
   `python scripts/enrich_all_content.py --target sections --limit 50 --max-runtime-minutes 20 --dry-run` (prints JSON, writes nothing), then without `--dry-run`.
3. Needs GROQ_API_KEY / GEMINI_API_KEY / NVIDIA_API_KEY in the container (exits 2 without one).

# company_intel

Per-company website crawler + grounded AI enrichment. **Separate from `services/api/crawler`** (the job crawler):
own folder, own `requirements.txt`, own Dockerfile, own workflow (`.github/workflows/company-intel.yml`).

```
seed   jobs table -> company_entities (slug, name, VERIFIED official domain; no domain => skipped)
crawl  homepage + links/probe paths on the company's own site -> company_sources   (robots.txt, 1.5s/host, <=14 pages)
enrich company_sources -> company_topics (10 topics; Groq -> Gemini -> NVIDIA fallback; grounded or rejected)
```

Run: `python -m company_intel.run {seed|crawl|enrich|all} [--limit N] [--only SLUG] [--dry-run]`
(needs `DATABASE_URL`; `enrich` also needs at least one of `GROQ_API_KEY` / `GEMINI_API_KEY` / `NVIDIA_API_KEY`).
Tests: `python -m pytest services/company_intel/tests`.

## Rules the code enforces
- Only verified employer domains are crawled. Job boards / ATS hosts (`domains.py`) are never an employer's site.
- robots.txt is honoured; if it cannot be read (5xx / network error) nothing is fetched. Redirects off the company's site are dropped.
- A topic is written only from pages crawled for it (>= 400 chars). Model output is **rejected, not edited** when it contains a
  number not in the sources, more than one capitalised name not in the sources, marketing fluff, or cites no source.
- Unchanged inputs (content hashes + prompt version) are not re-enriched. Pages are re-crawled after 30 days.
- A company page is indexable on topics alone from 5 published topics (`MIN_PUBLISHED_TOPICS`), or with 2+ live jobs.

## Not built yet
- Wikipedia / Wikidata as an extra source for founding year, size and funding (needs reliable entity matching first).
- JavaScript-rendered sites (plain HTTP only; those companies end up `skipped` with a reason).
- FAQPage schema: deliberately not built (no rich-result benefit for this site; see seo-remaining-items.md).

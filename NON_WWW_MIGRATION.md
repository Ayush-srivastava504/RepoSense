# Non-www migration + sitemap fixes (Phase 0 + 1)

Canonical host: **https://intern-flow.in** (no www). `www` is a 301 only.

## What changed
| Area | Change |
|---|---|
| `apps/web/lib/site.ts` (new) | Single source of truth for the origin. `lib/jobs.ts`, `lib/hackathons.ts` re-export it, `app/layout.tsx` imports it. A `NEXT_PUBLIC_SITE_URL` pointing at a www host is ignored. |
| `public/robots.txt`, 43 blog JSON files | `www` -> apex |
| `services/api` config / push script / `scripts/indexnow-submit.mjs` | IndexNow host + Google Indexing push now build **non-www** URLs (previously they pushed URLs that 301). |
| `lib/seo/seoMetrics.ts` | New `isIndexableJob()`; all 4 job-detail pages AND the sitemap use it, so the sitemap never lists a URL its page noindexes. |
| `app/sitemap-jobs.xml` | Uses `getJobsPage` + completeness check vs API `total`; **503** (not a partial 200) when incomplete; de-dupes ids; cap 50k; edge-cached 1h; no fabricated `lastmod`, no `changefreq/priority`. |
| all other sitemaps + index | Removed `lastmod = now`. |
| `services/api/src/routes/jobs.py` | `ORDER BY posted_at DESC NULLS LAST, id DESC` (deterministic pagination). Hackathons list gets `id` tie-breaker. |

## Deploy order
1. Deploy **API** first (ordering fix; it is backwards compatible).
2. Deploy **web** (this is what removes the www<->non-www canonical conflict).
3. Keep the Vercel `www -> intern-flow.in` 301 permanently. Primary domain = `intern-flow.in`.
4. Search Console (Domain property already covers both hosts): submit `https://intern-flow.in/sitemap.xml`.
5. Set/leave `INDEXNOW_HOST=intern-flow.in`; confirm `https://intern-flow.in/<INDEXNOW_KEY>.txt` returns 200.

## Verify after deploy
```
curl -sI https://www.intern-flow.in/jobs/x | grep -i -E "^HTTP|^location"     # one 301 -> https://intern-flow.in/jobs/x
curl -s https://intern-flow.in/sitemap-jobs.xml | grep -c "<loc>"              # ~ eligible jobs, no www
curl -s https://intern-flow.in/sitemap-jobs.xml | sort | uniq -d | head        # duplicates: none
curl -s https://intern-flow.in/robots.txt | grep -i sitemap
```

## Tests
```
cd apps/web && npm ci && npx tsc --noEmit && npm run test:sitemap   # 15 unit tests
cd apps/web && bash tests/e2e/run_e2e.sh                              # real Next server + mock API
cd services/api && pytest tests/test_jobs_pagination_order.py tests/test_phase_f_priority_push.py
```

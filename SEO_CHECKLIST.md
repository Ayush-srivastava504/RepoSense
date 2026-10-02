# SEO checklist: what is verified in code, and what you check in the browser

Canonical host: the apex `https://intern-flow.in` (`apps/web/lib/site.ts`). The www host only 301-redirects to it.
Replace `<path>` with a real URL, e.g. `/companies/<slug>` or `/jobs/<slug>`.

## A. Checked from code (tests + review, every release)
| Area | What is verified | Where |
|---|---|---|
| Canonical | one self-referencing canonical per page, built from `lib/site.ts`; `?page=N` kept for N>1 | generateMetadata in each route; test `no file emits the www host` |
| Title / description | built in one helper, pixel-truncated, "Page N" suffix on paginated pages | `lib/seo/seoMetrics.ts` |
| Index control | thin company / stale or thin job => `robots: noindex, follow`; noindexed URLs absent from sitemaps | `hubThresholds.ts`, `isIndexableJob` |
| Structured data | JobPosting (valid salary, validThrough, directApply=false), BreadcrumbList, Organization, FAQPage; no duplicate blocks; FAQ markup built from the same function as the visible FAQ | `lib/structuredData.ts`, `lib/jobFaq.ts`, test `job-faq` |
| Sitemaps | valid XML, apex URLs only, 503 (not an empty file) when the API fails | `app/sitemap-*.xml`, tests `sitemap-*` |
| Pagination | out-of-range page => 404; pagination links are plain anchors | company and list pages |
| Duplicate content | profile/topics on page 1 only; locale detail pages blocked in robots.txt | company page, robots.txt |
| Internal links | job -> company, skill chips -> /skills, explore-related, similar jobs, footer | JobDetail, ExploreRelated |
| Content quality | AI sections validated (numbers, keywords, fluff, emoji) before storage | `job_sections_service.py` + tests |
| Build health | `tsc --noEmit`, 104 web tests, API tests | CI / local |

## B. You check in the browser (needs the live site)
1. Redirect and status: `curl -sIL www.intern-flow.in/<path>` shows a 301 to `https://intern-flow.in/<path>`, then 200.
2. View source (Ctrl+U), search for:
   - `<title>`: one, under about 60 characters, contains the job title and company.
   - `meta name="description"`: one, 120-160 characters.
   - `rel="canonical"`: apex URL, same path.
   - `meta name="robots"`: absent on indexable pages, `noindex, follow` on thin ones.
   - `<h1>`: exactly one.
   - `application/ld+json`: job page => JobPosting + BreadcrumbList + FAQPage; company page => BreadcrumbList + Organization, no FAQPage.
   - The FAQ answers appear as normal text in the HTML (not only after a click).
3. Network tab (tick Disable cache, reload): document 200; `/og/<id>.png` or `/og/company/<slug>.png` is 200 `image/png`; no red requests; no 4xx/5xx to the API host; large JS bundles are not blocking first paint.
4. Rendered text check: view source must contain the responsibilities / prep / FAQ text. If it is only in the Elements panel, it is client-rendered and search engines may miss it.
5. Mobile: Chrome DevTools device mode; the Apply button is visible without scrolling.
6. Google Rich Results Test: job page shows "Job posting" valid with no errors; FAQ shows as detected.
7. Search Console: URL Inspection => "URL is on Google" or request indexing; Pages report for "Page with redirect" and "Discovered, not indexed" counts week over week; Sitemaps report shows the sitemap index as Success.
8. PageSpeed Insights (mobile): LCP, CLS, INP on one job page and one company page.

# Search Console "server connectivity" + sitemap 503s (Oct 2026)

## What was happening
- `sitemap-skills.xml` is `force-dynamic` and made ~48 live API calls per request (2 per skill, all at once). One slow or failed call -> the whole sitemap became a 503, which Search Console showed as "Sitemap could not be read - General HTTP error - 503". The same all-or-nothing pattern was in the other API-backed sitemaps and the index.
- `api.intern-flow.in` was being crawled by Googlebot (24 requests, "problems last week"). It is a JSON API and should never be in Google.

## What the code now does (apps/web/lib/sitemapResponse.ts)
1. API fails -> serve the last good copy this instance built (200, `x-sitemap-served: stale`).
2. No copy yet, and the list is static (skills, cities, batches) -> serve the full static list (200, `x-sitemap-served: fallback`). It cannot shrink.
3. companies / hackathons (list only exists in the API) -> still 503 + Retry-After, because a partial list reads as "removed".
4. Every sitemap response carries `stale-if-error=604800`, so the CDN can keep answering Googlebot from its old copy while the origin is down. Degraded answers are cached for only 300 s so the real build is retried quickly.
5. The skills sitemap runs 4 skills at a time (8 calls) instead of all at once.
6. The API sends `X-Robots-Tag: noindex, nofollow` on every response and serves `/robots.txt` with `Disallow: /`.

## What the code CANNOT fix (infrastructure) - check these
The crawl-stats screenshot shows `intern-flow.in` (the canonical host) failing server connectivity while `www.intern-flow.in` is healthy. Page source shows Cloudflare scripts (`/cdn-cgi/...`) on the apex, so check:
1. `curl -sI https://intern-flow.in | grep -iE "^(HTTP|server|cf-ray|location)"` and the same for `https://www.intern-flow.in`. If apex says `server: cloudflare` and www says `server: Vercel`, the two hosts take different paths and the apex is the one failing.
2. Cloudflare -> Security -> Events: filter by User Agent contains `Googlebot`, last 7 days. Any Challenge / Block / Managed Challenge rows = Cloudflare is fighting Googlebot. Turn off Bot Fight Mode, or add a rule: `cf.client.bot` -> Skip.
3. Cloudflare -> SSL/TLS mode must be Full (strict) in front of Vercel. Flexible causes redirect loops / connection failures.
4. Vercel recommends DNS-only (grey cloud) for its domains. If you do not need Cloudflare caching/WAF for the web app, switch the apex A record to DNS-only.
5. Cloudflare -> Scrape Shield: turn off Email Address Obfuscation (it rewrites `[email protected]` into the HTML) and Rocket Loader.
6. On the API box: `docker stats --no-stream` and `docker logs --since 7d reposense-api 2>&1 | grep -ciE "killed|oom|timeout"`. The API container has `mem_limit: 1024m`; an OOM kill = connection failures for everything that calls it.
7. Search Console -> Settings -> Crawl stats -> By response: look for 5xx and "Other client error" spikes and note the dates; match them to the Cloudflare and `docker logs` timestamps.
8. After deploying: Search Console -> Sitemaps -> resubmit `sitemap.xml`; `curl -sI https://intern-flow.in/sitemap-skills.xml | grep -iE "^(HTTP|x-sitemap-served|cache-control)"` should show 200.

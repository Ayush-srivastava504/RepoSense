# Search Console "server connectivity" + sitemap 503s (Oct 2026)

## What was happening
- `sitemap-skills.xml` is `force-dynamic` and made ~48 live API calls per request (2 per skill, all at once). One slow or failed call -> the whole sitemap became a 503, which Search Console showed as "Sitemap could not be read - General HTTP error - 503". The same all-or-nothing pattern was in the other API-backed sitemaps and the index.
- `api.intern-flow.in` was being crawled by Googlebot (24 requests, "problems last week"). It is a JSON API and should never be in Google.

## What the code does now (sitemap reliability, Oct 2026)
Every sitemap answers through one function, `serveSitemap()` in `apps/web/lib/sitemapResponse.ts`, and ends in a 200:
1. **Next Data Cache, 1 h** (`unstable_cache`): shared by all instances, survives restarts and deploys. A sitemap is built from the API at most once an hour instead of on every Googlebot hit. When the entry is stale Next serves it while rebuilding, and a failed rebuild leaves it in place. Verified on next@14.2.35: with the API killed, every sitemap kept returning its full list, also after a cold restart.
2. **This instance's last good copy** (`x-sitemap-served: stale`).
3. **Static fallback** built from data shipped with the app (`x-sitemap-served: fallback`), cached 5 min so the real build is retried quickly. Skills / cities / batches / careers / resume list every hub; hackathons / companies fall back to their hub page.
4. **503 + Retry-After** only for the per-file job sitemaps (`/sitemaps/<category>-<n>.xml`) and only when 1-3 are all empty AND the API is down (e.g. the first request after a first deploy during an outage). Nothing can be invented for them.
A build is cut off after 25 s so the platform's function timeout (shown in Search Console as a generic HTTP error) is never what Google sees. `SITEMAP_CACHE_TTL_S` overrides the 1 h TTL for drills only.
Every route sitemap (`app/sitemap-<slug>.xml/route.ts`) is a one-liner over `lib/routeSitemaps.ts`, which holds build + fallback + lastmod per sitemap. All of them now send `Cache-Control: s-maxage=3600, stale-while-revalidate, stale-if-error` and `Last-Modified`; tools / static / blog / careers / resume used to send none.

## Why some sitemaps were "last read" daily and others were not
Google re-reads a sitemap when it believes it changed. The job sitemaps carry per-URL `<lastmod>` and change hourly; skills / tools / static / careers / resume carried no dates at all and the index had no `<lastmod>` per child, so there was no signal. Now:
- the index has a `<lastmod>` on every child. Job files: when their content last changed (`sitemap_cache.built_at`, which the API now only moves when the XML differs). Route sitemaps: the newest real date in them (newest job `posted_at`, hackathon `first_seen_at`, company `last_posted_at`, blog `updatedAt`).
- dates are never "now" and never a deploy time. **tools** has no date on purpose (static copy), so Google may keep reading it less often. That is correct, not a bug.
- hubs that show a live job list (`/jobs`, `/careers/*`, `/resume-for/*`, `/batch/*`, ...) use the newest job date as an upper bound.
- `scripts/gsc-submit-sitemaps.mjs`, run by the `gsc-sitemaps` job in daily-pipeline.yml, asks Search Console to re-read the index and every child once a day. Needs the `GSC_SERVICE_ACCOUNT_JSON` secret (setup in the script header); without it the step is a no-op.
Google decides the real crawl schedule. "Last read" matching daily for every sitemap is the goal, not something any code can force.

## What the code CANNOT fix (infrastructure) - check these
The crawl-stats screenshot shows `intern-flow.in` (the canonical host) failing server connectivity while `www.intern-flow.in` is healthy. Page source shows Cloudflare scripts (`/cdn-cgi/...`) on the apex, so check:
1. `curl -sI https://intern-flow.in | grep -iE "^(HTTP|server|cf-ray|location)"` and the same for `If apex says `server: cloudflare` and www says `server: Vercel`, the two hosts take different paths and the apex is the one failing.
2. Cloudflare -> Security -> Events: filter by User Agent contains `Googlebot`, last 7 days. Any Challenge / Block / Managed Challenge rows = Cloudflare is fighting Googlebot. Turn off Bot Fight Mode, or add a rule: `cf.client.bot` -> Skip.
3. Cloudflare -> SSL/TLS mode must be Full (strict) in front of Vercel. Flexible causes redirect loops / connection failures.
4. Vercel recommends DNS-only (grey cloud) for its domains. If you do not need Cloudflare caching/WAF for the web app, switch the apex A record to DNS-only.
5. Cloudflare -> Scrape Shield: turn off Email Address Obfuscation (it rewrites `[email protected]` into the HTML) and Rocket Loader.
6. On the API box: `docker stats --no-stream` and `docker logs --since 7d reposense-api 2>&1 | grep -ciE "killed|oom|timeout"`. The API container has `mem_limit: 1024m`; an OOM kill = connection failures for everything that calls it.
7. Search Console -> Settings -> Crawl stats -> By response: look for 5xx and "Other client error" spikes and note the dates; match them to the Cloudflare and `docker logs` timestamps.
8. After deploying: Search Console -> Sitemaps -> resubmit `sitemap.xml`; `curl -sI https://intern-flow.in/sitemap-skills.xml | grep -iE "^(HTTP|x-sitemap-served|cache-control)"` should show 200.

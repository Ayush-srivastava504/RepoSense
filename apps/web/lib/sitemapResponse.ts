// Module: lib/sitemapResponse.ts
// Shared responses for the API-backed route sitemaps (hackathons, companies, skills, locations, batches).
//
// Policy, in order, when the API behind a sitemap fails:
//   1. serve the last good copy this instance built (200, header x-sitemap-served: stale);
//   2. else serve a static fallback built from data that ships with the app (200, x-sitemap-served: fallback),
//      only passed by routes whose URL list is static (skills / cities / batches), so it can never "shrink";
//   3. else 503 + Retry-After (companies / hackathons: their lists only exist in the API, and a partial list
//      would read to Google as "these URLs were removed", so we keep 503 and let Google keep its old copy).
// Before this, step 3 was the ONLY behaviour, so a single flaky API call turned a sitemap into a 503 that
// Search Console reported as "Couldn't fetch / General HTTP error".
//
// Cache-Control: s-maxage lets the CDN answer Googlebot without running the route at all; stale-while-revalidate
// + stale-if-error let it keep answering from the old copy while the origin is failing.

const OK_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800';
// Degraded answers are cached briefly so the CDN retries the real build soon.
const DEGRADED_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600, stale-if-error=604800';

const lastGood = new Map<string, string>();

function xmlResponse(xml: string, cache: string, served: string): Response {
    return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': cache, 'x-sitemap-served': served } });
}

export function sitemapOk(xml: string, name?: string): Response {
    if (name) lastGood.set(name, xml);
    return xmlResponse(xml, OK_CACHE, 'fresh');
}

export function sitemapUnavailable(name: string, err: unknown, fallbackXml?: () => string): Response {
    const stale = lastGood.get(name);
    if (stale) {
        console.error(`Sitemap "${name}" build failed, serving last good copy:`, err);
        return xmlResponse(stale, DEGRADED_CACHE, 'stale');
    }
    if (fallbackXml) {
        console.error(`Sitemap "${name}" build failed, serving static fallback:`, err);
        return xmlResponse(fallbackXml(), DEGRADED_CACHE, 'fallback');
    }
    console.error(`Sitemap "${name}" unavailable, serving 503:`, err);
    return new Response(`${name} sitemap temporarily unavailable`, {
        status: 503,
        headers: { 'Retry-After': '900', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

/** Run `fn` over `items` with at most `limit` in flight (the skills sitemap used to fire ~48 API calls at once). */
export async function mapWithLimit<T, R>(items: readonly T[], limit: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
        while (next < items.length) {
            const i = next++;
            results[i] = await fn(items[i], i);
        }
    });
    await Promise.all(workers);
    return results;
}

/** Test hook. */
export function _clearSitemapCache(): void {
    lastGood.clear();
}

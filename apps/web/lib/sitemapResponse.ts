// Module: lib/sitemapResponse.ts
// One place that decides how EVERY sitemap answers, so Search Console never sees a 5xx on one.
//
// serveSitemap(name, build, fallback) walks these layers, in order, and always ends in a 200:
//   1. Next Data Cache (unstable_cache, 1 h). Shared by every serverless instance and survives deploys, so a cold
//      instance does not have to rebuild. Once an entry exists Next keeps serving it while a background rebuild is
//      running, and if that rebuild fails the old entry simply stays (verified on next@14.2.35). A sitemap is therefore
//      built from the API at most once an hour, not once per Googlebot hit.
//   2. The last good copy this instance built (x-sitemap-served: stale).
//   3. `fallback()`: a static copy built only from data that ships with the app (x-sitemap-served: fallback).
//   4. Only when a route has no fallback at all (the per-file job sitemaps) and everything above is cold:
//      503 + Retry-After. Nothing can be invented for those, and a 503 is the correct "try again" answer.
//
// A build is also cut off after BUILD_DEADLINE_MS. Without that, a slow API would run into the platform's function
// timeout, which surfaces in Search Console as a generic "HTTP error" instead of a sitemap.
//
// Cache-Control: s-maxage lets the CDN answer Googlebot without running the route at all; stale-while-revalidate +
// stale-if-error let it keep answering from the old copy while the origin is failing. Degraded answers are cached for
// 5 minutes only, so the real build is retried soon.
import { unstable_cache } from 'next/cache';

export interface SitemapBuild {
    xml: string;
    /** Newest real change in this sitemap (ISO). Drives the index <lastmod> and the Last-Modified header. */
    lastmod?: string;
}

const OK_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=604800';
const DEGRADED_CACHE = 'public, s-maxage=300, stale-while-revalidate=3600, stale-if-error=604800';
// Overridable only so the outage behaviour can be exercised without waiting an hour; production uses the default.
const DATA_CACHE_TTL_S = Number(process.env.SITEMAP_CACHE_TTL_S) > 0 ? Number(process.env.SITEMAP_CACHE_TTL_S) : 3600;
const BUILD_DEADLINE_MS = 25_000;

const lastGood = new Map<string, SitemapBuild>();

function xmlResponse(b: SitemapBuild, cache: string, served: string): Response {
    const headers: Record<string, string> = {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': cache,
        'x-sitemap-served': served,
    };
    if (b.lastmod) {
        const t = new Date(b.lastmod);
        if (!Number.isNaN(t.getTime())) headers['Last-Modified'] = t.toUTCString();
    }
    return new Response(b.xml, { headers });
}

function unavailable(name: string): Response {
    return new Response(`${name} sitemap temporarily unavailable`, {
        status: 503,
        headers: { 'Retry-After': '900', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

function withDeadline<T>(p: Promise<T>, ms: number, name: string): Promise<T> {
    let timer: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`sitemap "${name}" build exceeded ${ms}ms`)), ms);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Run `build` through the Next Data Cache. A failure of `build` itself is rethrown untouched. If the cache machinery
 * is unavailable (unit tests, a runtime without an incremental cache) `build` just runs directly.
 */
async function viaDataCache(name: string, build: () => Promise<SitemapBuild | null>): Promise<SitemapBuild | null> {
    let buildError: unknown;
    let buildFailed = false;
    const cached = unstable_cache(
        async () => {
            try {
                return await build();
            }
            catch (err) {
                buildFailed = true;
                buildError = err;
                throw err;
            }
        },
        ['sitemap-v1', name],
        { revalidate: DATA_CACHE_TTL_S, tags: ['sitemaps', `sitemap:${name}`] },
    );
    try {
        return await cached();
    }
    catch (err) {
        if (buildFailed) throw buildError;
        return await build();
    }
}

/**
 * Never throws. Never returns 5xx unless `fallback` is omitted and every cache layer is cold.
 * `build` may resolve null = "this sitemap does not exist" -> 404 (cached briefly), not an error path.
 */
export async function serveSitemap(name: string, build: () => Promise<SitemapBuild | null>, fallback?: () => SitemapBuild): Promise<Response> {
    try {
        const built = await withDeadline(viaDataCache(name, build), BUILD_DEADLINE_MS, name);
        if (built === null) {
            lastGood.delete(name);
            return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=300' } });
        }
        lastGood.set(name, built);
        return xmlResponse(built, OK_CACHE, 'fresh');
    }
    catch (err) {
        const stale = lastGood.get(name);
        if (stale) {
            console.error(`Sitemap "${name}" build failed, serving last good copy:`, err);
            return xmlResponse(stale, DEGRADED_CACHE, 'stale');
        }
        if (fallback) {
            console.error(`Sitemap "${name}" build failed, serving static fallback:`, err);
            try {
                return xmlResponse(fallback(), DEGRADED_CACHE, 'fallback');
            }
            catch (fallbackErr) {
                console.error(`Sitemap "${name}" fallback failed too:`, fallbackErr);
            }
        }
        console.error(`Sitemap "${name}" unavailable, serving 503:`, err);
        return unavailable(name);
    }
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

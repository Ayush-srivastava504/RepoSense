// Module: lib/sitemapResponse.ts
// Shared responses for the API-backed route sitemaps (hackathons, companies, skills, locations, batches).
//
// Why: those routes used to swallow an upstream failure into an empty list and serve a normal-looking 200
// sitemap with the URLs missing (a hackathons sitemap with zero entries, skills/locations/batches with every
// hub page dropped). Search engines read that as "these URLs were removed". A 503 + Retry-After tells them
// to keep what they have and try again, same policy as app/sitemap.xml/route.ts for the job files.

const OK_CACHE = 'public, s-maxage=3600, stale-while-revalidate=86400';

export function sitemapOk(xml: string): Response {
    return new Response(xml, { headers: { 'Content-Type': 'application/xml', 'Cache-Control': OK_CACHE } });
}

export function sitemapUnavailable(name: string, err: unknown): Response {
    console.error(`Sitemap "${name}" unavailable, serving 503:`, err);
    return new Response(`${name} sitemap temporarily unavailable`, {
        status: 503,
        headers: { 'Retry-After': '900', 'Cache-Control': 'no-store', 'Content-Type': 'text/plain; charset=utf-8' },
    });
}

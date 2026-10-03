// Run: npm run test:sitemap   (node:test via tsx)
// The API-backed route sitemaps must answer 503 + Retry-After when the API fails -- never a 200 sitemap
// with the URLs silently missing -- and a normal 200 urlset when it works.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.API_BASE_URL = 'https://api.test.invalid';

const realFetch = globalThis.fetch;
const okBody = { items: [], jobs: [], total: 0, top: { companies: [] }, mass_hire: { companies: [] }, startup: { companies: [] },
    skills: [], courses: [], sources: [], batches: [], companies: [] };

function mockFetch(mode: 'fail500' | 'throw' | 'ok') {
    globalThis.fetch = (async () => {
        if (mode === 'throw') throw new Error('network down');
        if (mode === 'fail500') return new Response('boom', { status: 500 });
        return new Response(JSON.stringify(okBody), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
}

const ROUTES: [string, () => Promise<{ GET: () => Promise<Response> }>][] = [
    ['hackathons', () => import('../app/sitemap-hackathons.xml/route')],
    ['companies', () => import('../app/sitemap-companies.xml/route')],
    ['skills', () => import('../app/sitemap-skills.xml/route')],
    ['locations', () => import('../app/sitemap-locations.xml/route')],
    ['batches', () => import('../app/sitemap-batches.xml/route')],
];

const STATIC_LIST_ROUTES = new Set(['skills', 'locations', 'batches']);

test.after(() => { globalThis.fetch = realFetch; });

for (const [name, load] of ROUTES) {
    for (const mode of ['fail500', 'throw'] as const) {
        if (STATIC_LIST_ROUTES.has(name)) {
            // Their URL list ships with the app, so an API failure serves the full static list (200) instead of a
            // 503 that Search Console reports as "Couldn't fetch". It can never shrink: every hub is included.
            test(`${name}: API ${mode} -> 200 static fallback (full hub list), never a 503 or a shrunk sitemap`, async () => {
                mockFetch(mode);
                const res = await (await load()).GET();
                assert.equal(res.status, 200);
                assert.equal(res.headers.get('x-sitemap-served'), 'fallback');
                assert.match(res.headers.get('Cache-Control') ?? '', /stale-if-error/);
                const xml = await res.text();
                assert.match(xml, /<urlset[\s\S]*<\/urlset>/);
                assert.ok((xml.match(/<loc>/g) ?? []).length > 5, 'fallback must list every hub, not an empty/shrunk set');
            });
        } else {
            // companies / hackathons only exist in the API: a partial list would read as "removed", so 503 stays.
            test(`${name}: API ${mode} -> 503 with Retry-After, not a shrunk 200`, async () => {
                mockFetch(mode);
                const res = await (await load()).GET();
                assert.equal(res.status, 503);
                assert.equal(res.headers.get('Retry-After'), '900');
                assert.equal(res.headers.get('Cache-Control'), 'no-store');
            });
        }
    }
    test(`${name}: healthy API -> 200 urlset`, async () => {
        mockFetch('ok');
        const res = await (await load()).GET();
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('Content-Type'), 'application/xml');
        const xml = await res.text();
        assert.match(xml, /<urlset[\s\S]*<\/urlset>/);
    });
}

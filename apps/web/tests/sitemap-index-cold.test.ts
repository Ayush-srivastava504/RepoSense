// Run: npm run test:sitemap
// Separate file on purpose: node:test gives each file its own process, so no earlier successful build has left a
// remembered file list / category registry / last-good copy behind. This is the true cold start with the API down.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.API_BASE_URL = 'https://api.test.invalid';

const realFetch = globalThis.fetch;
test.after(() => { globalThis.fetch = realFetch; });

const SLUGS = ['static', 'hackathons', 'tools', 'blog', 'skills', 'companies', 'locations', 'batches', 'resume', 'careers'];

for (const mode of ['fail500', 'throw'] as const) {
    test(`index: cold start + API ${mode} -> 200 static index (all route sitemaps + job files), never a 503`, async () => {
        globalThis.fetch = (async () => {
            if (mode === 'throw') throw new Error('network down');
            return new Response('boom', { status: 500 });
        }) as typeof fetch;
        const { GET } = await import('../app/sitemap.xml/route');
        const res = await GET();
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('x-sitemap-served'), 'fallback');
        assert.match(res.headers.get('Cache-Control') ?? '', /s-maxage=300/);
        const xml = await res.text();
        assert.match(xml, /<sitemapindex[\s\S]*<\/sitemapindex>/);
        for (const slug of SLUGS) assert.ok(xml.includes(`/sitemap-${slug}.xml`), `${slug} missing from fallback index`);
        for (const f of ['jobs-1.xml', 'internships-1.xml', 'remote-jobs-1.xml', 'government-jobs-1.xml']) assert.ok(xml.includes(`/sitemaps/${f}`), f);
    });
}

test('job file sitemap: cold start + API down is the only remaining 503 (nothing can be invented), with Retry-After', async () => {
    globalThis.fetch = (async () => { throw new Error('network down'); }) as typeof fetch;
    const { GET } = await import('../app/sitemaps/[file]/route');
    const res = await GET(new Request('https://x'), { params: { file: 'jobs-1.xml' } });
    assert.equal(res.status, 503);
    assert.equal(res.headers.get('Retry-After'), '900');
});

// Run: npm run test:sitemap   (node:test via tsx)
// Contract for every sitemap route:
//   * the API failing NEVER produces a 5xx (it used to: "Couldn't fetch / General HTTP error / 503" in Search Console),
//   * a healthy API produces a 200 urlset with real <lastmod> dates (never "now", never a future date),
//   * the index carries a <lastmod> per child sitemap.
import test from 'node:test';
import assert from 'node:assert/strict';

process.env.API_BASE_URL = 'https://api.test.invalid';

const realFetch = globalThis.fetch;
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();
const NEWEST_JOB = daysAgo(1);

const JOBS = [
    { id: 'j1', title: 'Backend Engineer', company: 'Acme', location: 'Bengaluru, Karnataka', posted_at: daysAgo(3) },
    { id: 'j2', title: 'Data Analyst', company: 'Acme', location: 'Pune', posted_at: NEWEST_JOB },
    { id: 'j3', title: 'Future Dated', company: 'Acme', location: 'Pune', posted_at: new Date(Date.now() + 30 * DAY).toISOString() },
];

function apiBody(url: string): unknown {
    if (url.includes('/api/sitemap/files')) return { files: [{ file_name: 'jobs-1.xml', url_count: 3, built_at: daysAgo(2) }, { file_name: 'internships-1.xml', url_count: 2, built_at: NEWEST_JOB }] };
    if (url.includes('/api/sitemap/categories')) {
        return { categories: [
            { slug: 'static', kind: 'route', path: '/sitemap-static.xml', sort_order: 10 },
            { slug: 'jobs', kind: 'job_cache', path: null, sort_order: 20 },
            { slug: 'internships', kind: 'job_cache', path: null, sort_order: 21 },
            { slug: 'tools', kind: 'route', path: '/sitemap-tools.xml', sort_order: 40 },
            { slug: 'skills', kind: 'route', path: '/sitemap-skills.xml', sort_order: 60 },
            { slug: 'hackathons', kind: 'route', path: '/sitemap-hackathons.xml', sort_order: 70 },
        ] };
    }
    if (url.includes('/api/jobs/facets')) return { batches: [{ value: '2026', label: '2026', count: 99 }], skills: [], courses: [], sources: [], companies: [] };
    if (url.includes('/api/jobs')) return { jobs: JOBS, total: JOBS.length };
    if (url.includes('/api/companies/directory')) return { letters: [{ letter: 'a' }], letter: null };
    if (url.includes('/api/companies/intel/sitemap')) return { companies: [] };
    if (url.includes('/api/companies')) {
        return { top: { companies: [{ company: 'Acme', job_count: 9, last_posted_at: NEWEST_JOB }] }, mass_hire: { companies: [] }, startup: { companies: [] } };
    }
    if (url.includes('/api/hackathons')) return { items: [{ slug: 'hack-1', title: 'Hack 1', first_seen_at: daysAgo(2) }] };
    return {};
}

function mockFetch(mode: 'fail500' | 'throw' | 'ok') {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        if (mode === 'throw') throw new Error('network down');
        if (mode === 'fail500') return new Response('boom', { status: 500 });
        return new Response(JSON.stringify(apiBody(String(input))), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
}

const SLUGS = ['static', 'hackathons', 'tools', 'blog', 'skills', 'companies', 'locations', 'batches', 'resume', 'careers'] as const;
const load = (slug: string) => import(`../app/sitemap-${slug}.xml/route`) as Promise<{ GET: () => Promise<Response> }>;
const locs = (xml: string) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const lastmods = (xml: string) => [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);

test.after(() => { globalThis.fetch = realFetch; });

test.beforeEach(async () => {
    (await import('../lib/sitemapResponse'))._clearSitemapCache();
});

for (const slug of SLUGS) {
    for (const mode of ['fail500', 'throw'] as const) {
        test(`${slug}: API ${mode} -> 200 urlset, never a 5xx`, async () => {
            mockFetch(mode);
            const res = await (await load(slug)).GET();
            assert.equal(res.status, 200, `${slug} must not fail when the API does`);
            assert.match(res.headers.get('Content-Type') ?? '', /application\/xml/);
            assert.match(res.headers.get('Cache-Control') ?? '', /stale-if-error/);
            const xml = await res.text();
            assert.match(xml, /<urlset[\s\S]*<\/urlset>/);
            assert.ok(locs(xml).length >= 1, 'a sitemap must never be empty');
            // tools/blog need no API. Everything else would otherwise be cached WITHOUT its dates (replacing the dated
            // copy for an hour), so a failing API sends it to the full undated static fallback instead.
            const needsApi = !['tools', 'blog'].includes(slug);
            assert.equal(res.headers.get('x-sitemap-served'), needsApi ? 'fallback' : 'fresh');
        });
    }

    test(`${slug}: healthy API -> 200 urlset with the same headers`, async () => {
        mockFetch('ok');
        const res = await (await load(slug)).GET();
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('x-sitemap-served'), 'fresh');
        assert.match(res.headers.get('Cache-Control') ?? '', /s-maxage=3600/);
        assert.match(await res.text(), /<urlset[\s\S]*<\/urlset>/);
    });
}

test('the static fallback of the static-list sitemaps lists every hub (it cannot shrink)', async () => {
    mockFetch('throw');
    for (const slug of ['skills', 'locations', 'batches', 'careers', 'resume']) {
        const xml = await (await (await load(slug)).GET()).text();
        assert.ok(locs(xml).length > 5, `${slug} fallback must list every hub`);
    }
});

test('lastmod is a real job date: hubs get the newest non-future job, static pages get none', async () => {
    mockFetch('ok');
    const xml = await (await (await load('static')).GET()).text();
    const block = (path: string) => xml.split('<url>').find((b) => b.includes(`<loc>https://intern-flow.in${path}</loc>`)) ?? '';
    assert.ok(block('/jobs').includes(`<lastmod>${NEWEST_JOB}</lastmod>`), '/jobs lastmod = newest job posted_at');
    assert.ok(!block('/about').includes('<lastmod>'), '/about has no honest date, so none is emitted');
    const now = Date.now();
    for (const lm of lastmods(xml)) assert.ok(new Date(lm).getTime() <= now, `lastmod ${lm} is in the future`);
});

test('skills / locations / companies lastmod come from the data they list', async () => {
    mockFetch('ok');
    const skills = await (await (await load('skills')).GET()).text();
    assert.ok(lastmods(skills).includes(NEWEST_JOB));
    const locations = await (await (await load('locations')).GET()).text();
    assert.ok(lastmods(locations).includes(NEWEST_JOB), 'Pune has the newest job');
    const companies = await (await (await load('companies')).GET()).text();
    assert.ok(companies.includes('<loc>https://intern-flow.in/companies/acme</loc>'));
    assert.ok(lastmods(companies).includes(NEWEST_JOB));
});

test('no sitemap ever emits a lastmod newer than now', async () => {
    mockFetch('ok');
    const now = Date.now();
    for (const slug of SLUGS) {
        for (const lm of lastmods(await (await (await load(slug)).GET()).text())) {
            assert.ok(!Number.isNaN(new Date(lm).getTime()), `${slug}: ${lm} is not a date`);
            assert.ok(new Date(lm).getTime() <= now, `${slug}: ${lm} is in the future`);
        }
    }
});

// ---------------------------------------------------------------- the index
const loadIndex = () => import('../app/sitemap.xml/route') as Promise<{ GET: () => Promise<Response> }>;

test('index: every <sitemap> has a <lastmod>, job files use their content-change date, tools has none', async () => {
    mockFetch('ok');
    const res = await (await loadIndex()).GET();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-sitemap-served'), 'fresh');
    const xml = await res.text();
    const entries = xml.split('<sitemap>').slice(1);
    assert.equal(entries.length, 6);
    const entry = (path: string) => entries.find((e) => e.includes(`<loc>https://intern-flow.in${path}</loc>`)) ?? '';
    assert.ok(entry('/sitemaps/jobs-1.xml').includes('<lastmod>'));
    assert.ok(entry('/sitemaps/internships-1.xml').includes(`<lastmod>${NEWEST_JOB}</lastmod>`));
    assert.ok(entry('/sitemap-skills.xml').includes(`<lastmod>${NEWEST_JOB}</lastmod>`));
    assert.ok(entry('/sitemap-static.xml').includes(`<lastmod>${NEWEST_JOB}</lastmod>`));
    assert.ok(!entry('/sitemap-tools.xml').includes('<lastmod>'), 'static content: no invented date');
    assert.ok(res.headers.get('Last-Modified'));
});

test('index: one broken endpoint drops that tag only, never the entry or the index', async () => {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/hackathons')) return new Response('boom', { status: 500 });
        return new Response(JSON.stringify(apiBody(url)), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }) as typeof fetch;
    const res = await (await loadIndex()).GET();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('x-sitemap-served'), 'fresh');
    const entries = (await res.text()).split('<sitemap>').slice(1);
    const hack = entries.find((e) => e.includes('/sitemap-hackathons.xml')) ?? '';
    const skills = entries.find((e) => e.includes('/sitemap-skills.xml')) ?? '';
    assert.ok(hack && !hack.includes('<lastmod>'), 'hackathons entry stays, without a date');
    assert.ok(skills.includes('<lastmod>'), 'the other entries keep their dates');
});

test('index: after one good build, an API outage serves that copy (stale), not the fallback', async () => {
    mockFetch('ok');
    const good = await (await (await loadIndex()).GET()).text();
    mockFetch('throw');
    const res = await (await loadIndex()).GET();
    assert.equal(res.status, 200);
    // most lastmod lookups fail -> the index is NOT rebuilt without its dates; the dated copy is served
    assert.equal(res.headers.get('x-sitemap-served'), 'stale');
    assert.equal(await res.text(), good);
    assert.ok(good.includes('<lastmod>'));
});

// ---------------------------------------------------------------- per-file job sitemaps
const loadFile = () => import('../app/sitemaps/[file]/route') as Promise<{ GET: (r: Request, c: { params: { file: string } }) => Promise<Response> }>;

test('job file sitemap: served with lastmod header, 404 for unknown names, stale on API outage', async () => {
    const xml = '<?xml version="1.0"?><urlset><url><loc>https://intern-flow.in/jobs/a</loc><lastmod>' + NEWEST_JOB + '</lastmod></url></urlset>';
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/jobs-1.xml')) return new Response(xml, { status: 200 });
        return new Response('nope', { status: 404 });
    }) as typeof fetch;
    const { GET } = await loadFile();
    const ok = await GET(new Request('https://x'), { params: { file: 'jobs-1.xml' } });
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('Last-Modified'), new Date(NEWEST_JOB).toUTCString());
    assert.equal((await GET(new Request('https://x'), { params: { file: 'jobs-9.xml' } })).status, 404);
    assert.equal((await GET(new Request('https://x'), { params: { file: 'evil.xml' } })).status, 404);
    mockFetch('throw');
    const stale = await GET(new Request('https://x'), { params: { file: 'jobs-1.xml' } });
    assert.equal(stale.status, 200);
    assert.equal(await stale.text(), xml);
});

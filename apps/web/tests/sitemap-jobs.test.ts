// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { BASE_URL } from '../lib/site';
import { buildUrlsetXml } from '../lib/sitemapXml';
import { isIndexableJob } from '../lib/seo/seoMetrics';
import {
    buildJobSitemapEntries,
    collectAllJobs,
    IncompleteSitemapError,
    toLastmod,
    isJobForSitemap,
    buildCategorySitemapEntries,
    chunkEntries,
    parseSitemapFileName,
    categorySitemapUrls,
    SITEMAP_URLS_PER_FILE,
} from '../lib/sitemapJobs';

const DAY = 86400000;
const NOW = Date.parse('2026-09-20T12:00:00Z');
const iso = (offsetDays: number) => new Date(NOW + offsetDays * DAY).toISOString();

function job(id: string, extra: Record<string, unknown> = {}) {
    return { id, title: `Engineer ${id}`, company: 'Acme', location: 'Pune', posted_at: iso(-3), ...extra } as any;
}

// ---------- host ----------
test('BASE_URL is the non-www canonical host', () => {
    assert.equal(BASE_URL, 'https://intern-flow.in');
});

test('site.ts ignores a www override but accepts a staging one', () => {
    const baseUrlWith = (override: string) =>
        execFileSync('npx', ['--yes', 'tsx', '-e', "import('./lib/site').then((m) => console.log((m.BASE_URL ?? m.default.BASE_URL)))"], {
            cwd: resolve(__dirname, '..'),
            env: { ...process.env, NEXT_PUBLIC_SITE_URL: override },
        }).toString().trim();
    assert.equal(baseUrlWith('https://www.intern-flow.in/'), 'https://intern-flow.in');
    assert.equal(baseUrlWith('ftp://weird'), 'https://intern-flow.in');
    assert.equal(baseUrlWith('https://staging.intern-flow.in/'), 'https://staging.intern-flow.in');
});

function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
        if (['node_modules', '.next', '.git', '__pycache__'].includes(name)) continue;
        const p = join(dir, name);
        statSync(p).isDirectory() ? walk(p, out) : out.push(p);
    }
    return out;
}

test('no file in the repo emits the www host (regression guard)', () => {
    const root = resolve(__dirname, '../../..');
    const offenders: string[] = [];
    for (const f of walk(root)) {
        if (!/\.(ts|tsx|js|mjs|py|json|txt|md|yml|yaml)$/.test(f)) continue;
        if (f.endsWith('sitemap-jobs.test.ts') || f.endsWith('lib/site.ts')) continue;
        if (f.endsWith('config.py')) continue; // CORS regex intentionally accepts both hosts
        if (f.endsWith('NON_WWW_MIGRATION.md')) continue; // runbook that documents the old host on purpose
        if (/https?:\/\/www\.intern-flow\.in|'www\.intern-flow\.in'/.test(readFileSync(f, 'utf8'))) offenders.push(f);
    }
    assert.deepEqual(offenders, []);
});

test('robots.txt points at the non-www sitemap index', () => {
    const robots = readFileSync(resolve(__dirname, '../public/robots.txt'), 'utf8');
    assert.match(robots, /^Sitemap: https:\/\/intern-flow\.in\/sitemap\.xml$/m);
    assert.doesNotMatch(robots, /www\.intern-flow/);
});

// ---------- entries ----------
test('every <loc> is on the canonical host', () => {
    const entries = buildJobSitemapEntries([job('a1'), job('b2', { type: 'internship' })], NOW);
    assert.equal(entries.length, 2);
    for (const e of entries) assert.ok(e.loc.startsWith('https://intern-flow.in/'), e.loc);
});

test('expired deadline, stale-by-45-days and thin-unenriched jobs are excluded', () => {
    const jobs = [
        job('live'),
        job('expired', { deadline: iso(-1) }),
        job('future', { deadline: iso(10) }),
        job('stale45', { posted_at: iso(-60) }), // no deadline, >45d old
        job('thin', { is_thin: true }),
        job('thinenriched', { is_thin: true, enriched_overview: 'Real overview' }),
    ];
    // isStaleForIndexing/isThinAndUnenriched read Date.now(); freeze it for determinism
    const realNow = Date.now;
    Date.now = () => NOW;
    try {
        const ids = buildJobSitemapEntries(jobs, NOW).map((e) => e.loc.split('-').pop());
        assert.deepEqual(ids.sort(), ['future', 'live', 'thinenriched'].sort());
    } finally {
        Date.now = realNow;
    }
});

test('sitemap eligibility equals the page-level noindex rule (no conflicting signals)', () => {
    const realNow = Date.now;
    Date.now = () => NOW;
    try {
        const jobs = [
            job('a'), job('b', { deadline: iso(-5) }), job('c', { posted_at: iso(-90) }),
            job('d', { is_thin: true }), job('e', { posted_at: undefined }), job('f', { deadline: 'garbage' }),
        ];
        const inSitemap = new Set(buildJobSitemapEntries(jobs, NOW).map((e) => e.loc.split('-').pop()));
        for (const j of jobs) assert.equal(inSitemap.has(j.id), isIndexableJob(j), j.id);
    } finally {
        Date.now = realNow;
    }
});

test('duplicate ids from the API are de-duplicated', () => {
    const entries = buildJobSitemapEntries([job('x1'), job('x1'), job('x2')], NOW);
    assert.equal(entries.length, 2);
    assert.equal(new Set(entries.map((e) => e.loc)).size, 2);
});

test('lastmod is real or absent, never fabricated', () => {
    const [withDate, noDate, future] = buildJobSitemapEntries(
        [job('d1', { posted_at: '2026-09-10T00:00:00Z' }), job('d2', { posted_at: undefined }), job('d3', { posted_at: iso(+30) })],
        NOW
    );
    assert.equal(withDate.lastmod, '2026-09-10T00:00:00.000Z');
    assert.equal(noDate.lastmod, undefined);
    assert.equal(future.lastmod, undefined);
    assert.equal(toLastmod('not a date', NOW), undefined);
    const xml = buildUrlsetXml([noDate]);
    assert.doesNotMatch(xml, /<lastmod>/);
    assert.match(xml, /<\/urlset>$/);
});

// ---------- pagination / completeness ----------
function fakeApi(n: number, opts: { failPage?: number } = {}) {
    const all = Array.from({ length: n }, (_, i) => job(`j${String(i).padStart(5, '0')}`));
    return async (offset: number, limit: number) => {
        if (opts.failPage !== undefined && offset === opts.failPage * limit) return { jobs: [], total: 0 }; // what getJobsPage does on 429
        return { jobs: all.slice(offset, offset + limit), total: n };
    };
}

test('collectAllJobs returns every job exactly once', async () => {
    const jobs = await collectAllJobs(fakeApi(1234), { pageSize: 100, concurrency: 3 });
    assert.equal(jobs.length, 1234);
    assert.equal(new Set(jobs.map((j) => j.id)).size, 1234);
});

test('collectAllJobs handles exact multiples of the page size', async () => {
    const jobs = await collectAllJobs(fakeApi(500), { pageSize: 100 });
    assert.equal(jobs.length, 500);
});

test('a rate-limited middle page throws instead of yielding a truncated sitemap', async () => {
    await assert.rejects(() => collectAllJobs(fakeApi(1000, { failPage: 4 }), { pageSize: 100 }), IncompleteSitemapError);
});

test('a rate-limited LAST page also throws', async () => {
    await assert.rejects(() => collectAllJobs(fakeApi(1000, { failPage: 9 }), { pageSize: 100 }), IncompleteSitemapError);
});

test('empty first page (API down) throws', async () => {
    await assert.rejects(() => collectAllJobs(async () => ({ jobs: [], total: 0 })), IncompleteSitemapError);
});

test('maxPages caps the crawl', async () => {
    const jobs = await collectAllJobs(fakeApi(1000), { pageSize: 100, maxPages: 3 });
    assert.equal(jobs.length, 300);
});

// ---------- stage 3: category sitemaps (sitemap-only priority rule) ----------
const enriched = { enriched_overview: 'Real overview' };

test('isJobForSitemap needs enrichment and recency; falls back to last_seen_at', () => {
    assert.equal(isJobForSitemap(job('a', enriched), NOW), true);
    assert.equal(isJobForSitemap(job('b'), NOW), false); // not enriched
    assert.equal(isJobForSitemap(job('c', { ...enriched, posted_at: iso(-30) }), NOW), true); // within the 30d "always" tier
    // posted_at NULL (very common) -> judged on last_seen_at
    assert.equal(isJobForSitemap(job('d', { ...enriched, posted_at: undefined, last_seen_at: iso(-2) }), NOW), true);
    assert.equal(isJobForSitemap(job('e', { ...enriched, posted_at: undefined, last_seen_at: iso(-40), quality_score: 10 }), NOW), false); // mid-tier, low quality
    // no date at all -> can't prove recent
    assert.equal(isJobForSitemap(job('f', { ...enriched, posted_at: undefined }), NOW), false);
    // future-dated posted_at (clock skew / bad scrape data) -> don't trust it
    assert.equal(isJobForSitemap(job('g', { ...enriched, posted_at: iso(5) }), NOW), false);
});

test('isJobForSitemap: mid tier (31-90d) needs quality_score >= 50, old tier (90d+) needs >= 75', () => {
    // deadline is explicit + future here so isStaleForIndexing() (which checks
    // against the real clock, not the test's fixed NOW) doesn't mark an old
    // posted_at as expired -- isolates the quality_score tier logic being tested.
    const futureDeadline = iso(365);
    const midAge = { ...enriched, posted_at: iso(-60), deadline: futureDeadline };
    assert.equal(isJobForSitemap(job('m1', { ...midAge, quality_score: 49 }), NOW), false);
    assert.equal(isJobForSitemap(job('m2', { ...midAge, quality_score: 50 }), NOW), true);
    assert.equal(isJobForSitemap(job('m3', midAge), NOW), false); // no quality_score -> treated as 0

    const oldAge = { ...enriched, posted_at: iso(-120), deadline: futureDeadline };
    assert.equal(isJobForSitemap(job('o1', { ...oldAge, quality_score: 74 }), NOW), false);
    assert.equal(isJobForSitemap(job('o2', { ...oldAge, quality_score: 75 }), NOW), true);
});

test('leaving a job out of the sitemap does NOT make its page noindex', () => {
    const realNow = Date.now;
    Date.now = () => NOW;
    try {
        const notPrioritised = job('old', { posted_at: iso(-30) }); // unenriched + 30d old
        assert.equal(isJobForSitemap(notPrioritised, NOW), false);
        assert.equal(isIndexableJob(notPrioritised), true); // page-level rule unchanged
    } finally {
        Date.now = realNow;
    }
});

test('each priority job lands in exactly one category (government > internship > remote > jobs)', () => {
    const realNow = Date.now;
    Date.now = () => NOW;
    try {
        const b = buildCategorySitemapEntries([
            job('g1', { ...enriched, is_government: true, is_remote: true, type: 'internship' }),
            job('i1', { ...enriched, type: 'internship', is_remote: true }),
            job('r1', { ...enriched, is_remote: true }),
            job('j1', enriched),
            job('j1', enriched), // duplicate id
            job('skip'), // not enriched
        ], NOW);
        assert.equal(b['government-jobs'].length, 1);
        assert.equal(b.internships.length, 1);
        assert.equal(b['remote-jobs'].length, 1);
        assert.equal(b.jobs.length, 1);
        assert.match(b['government-jobs'][0].loc, /^https:\/\/intern-flow\.in\/government-jobs\//);
        assert.match(b.internships[0].loc, /^https:\/\/intern-flow\.in\/internships\//);
        assert.match(b['remote-jobs'][0].loc, /^https:\/\/intern-flow\.in\/remote-jobs\//);
        assert.match(b.jobs[0].loc, /^https:\/\/intern-flow\.in\/jobs\//);
    } finally {
        Date.now = realNow;
    }
});

test('chunking, file names and index URLs line up', () => {
    const items = Array.from({ length: 2500 }, (_, i) => i);
    const chunks = chunkEntries(items);
    assert.deepEqual(chunks.map((c) => c.length), [SITEMAP_URLS_PER_FILE, SITEMAP_URLS_PER_FILE, 500]);
    assert.deepEqual(chunkEntries([]), []);
    assert.deepEqual(parseSitemapFileName('internships-2.xml'), { category: 'internships', page: 2 });
    assert.deepEqual(parseSitemapFileName('remote-jobs-10.xml'), { category: 'remote-jobs', page: 10 });
    for (const bad of ['jobs-0.xml', 'jobs.xml', 'jobs-1', '../jobs-1.xml', 'blog-1.xml', 'jobs-1.xml.gz'])
        assert.equal(parseSitemapFileName(bad), null, bad);
    const mk = (n: number) => Array.from({ length: n }, (_, i) => ({ loc: `https://intern-flow.in/x/${i}` }));
    const urls = categorySitemapUrls({ jobs: mk(2500), internships: mk(1), 'remote-jobs': [], 'government-jobs': [] });
    assert.deepEqual(urls, [
        'https://intern-flow.in/sitemaps/jobs-1.xml',
        'https://intern-flow.in/sitemaps/jobs-2.xml',
        'https://intern-flow.in/sitemaps/jobs-3.xml',
        'https://intern-flow.in/sitemaps/internships-1.xml',
    ]);
});

test('category entries never use last_seen_at for lastmod', () => {
    const b = buildCategorySitemapEntries([
        job('nodate', { ...enriched, posted_at: undefined, last_seen_at: iso(-1) }), // eligible via last_seen_at
        job('dated', { ...enriched, posted_at: '2026-09-15T00:00:00Z', last_seen_at: iso(-1) }),
    ], NOW);
    const byId = Object.fromEntries(b.jobs.map((e) => [e.loc.split('-').pop(), e]));
    assert.equal(byId['nodate'].lastmod, undefined);
    assert.equal(byId['dated'].lastmod, '2026-09-15T00:00:00.000Z');
});

test('lastmod falls back to created_at (never last_seen_at) when posted_at is missing', () => {
    const b = buildCategorySitemapEntries([
        job('cdate', { ...enriched, posted_at: undefined, created_at: '2026-09-10T00:00:00Z', last_seen_at: iso(-1) }),
    ], NOW);
    const entry = b.jobs.find((e) => e.loc.endsWith('cdate'));
    assert.equal(entry?.lastmod, '2026-09-10T00:00:00.000Z');
});

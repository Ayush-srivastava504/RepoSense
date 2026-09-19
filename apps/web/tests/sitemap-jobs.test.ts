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

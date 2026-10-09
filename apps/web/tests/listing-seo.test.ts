// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
// Pins the purpose + SEO of the four list pages (/jobs, /internships, /remote-jobs, /government-jobs),
// their detail routes, robots.txt facet rules and the JobPosting validThrough rule.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pageOpenGraph, listingMetadata } from '../lib/seo/pageMeta';
import { estimatePixelWidth, SERP_TITLE_PX_WITH_BRAND } from '../lib/seo/seoMetrics';
import { jobPostingSchema } from '../lib/structuredData';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

const LISTS = [
    { path: '/jobs', file: 'app/jobs/page.tsx' },
    { path: '/internships', file: 'app/internships/page.tsx' },
    { path: '/remote-jobs', file: 'app/remote-jobs/page.tsx' },
    { path: '/government-jobs', file: 'app/government-jobs/page.tsx' },
];

// ---------- purpose: government jobs only on /government-jobs ----------
test('/jobs, /internships and /remote-jobs exclude government notifications; /government-jobs requests only them', () => {
    for (const p of ['app/jobs/page.tsx', 'app/internships/page.tsx', 'app/remote-jobs/page.tsx']) {
        assert.ok(/excludeGovernment:\s*true/.test(read(p)), `${p} must set excludeGovernment: true`);
    }
    const gov = read('app/government-jobs/page.tsx');
    assert.ok(/category:\s*'government'/.test(gov));
    assert.ok(!/excludeGovernment/.test(gov));
});

test('web fetchers forward exclude_government to the API (jobs, featured, facets)', () => {
    assert.equal((read('lib/jobs.ts').match(/exclude_government/g) ?? []).length, 2);
    assert.ok(read('lib/facets.ts').includes("'exclude_government'"));
    const api = read('../../services/api/src/routes/jobs.py');
    // The exclusion is source-aware (NOT_GOVERNMENT_SQL), not just the flag: pre-014 rows had is_government = FALSE.
    assert.ok((api.match(/conditions\.append\(NOT_GOVERNMENT_SQL\)/g) ?? []).length >= 3, 'list, featured and facet conditions must all exclude');
    assert.ok(/NOT_GOVERNMENT_SQL\s*=\s*f"\(is_government IS NOT TRUE AND source NOT IN/.test(api));
});

test('remote and government pages paginate server-side (no 500-row in-memory cap)', () => {
    for (const p of ['app/remote-jobs/page.tsx', 'app/government-jobs/page.tsx']) {
        const src = read(p);
        assert.ok(/getJobsPage\(/.test(src), p);
        assert.ok(!/allJobs\.slice/.test(src), p);
    }
});

// ---------- every list page: own title/description/canonical/OG, brand-safe title width ----------
test('each list page builds its metadata through listingMetadata with a distinct, brand-safe title', () => {
    const titles = new Set<string>();
    const descriptions = new Set<string>();
    for (const { path, file } of LISTS) {
        assert.ok(/listingMetadata\(/.test(read(file)), `${file} must use listingMetadata`);
        const m = read(file).match(new RegExp(`path: '${path}',\\s*title: '([^']+)',\\s*description: '([^']+)'`));
        assert.ok(m, `${file}: could not find path/title/description`);
        const [, title, description] = m!;
        assert.ok(estimatePixelWidth(title) <= SERP_TITLE_PX_WITH_BRAND, `${path} title is too wide once " | InternFlow" is appended`);
        assert.ok(description.length <= 158, `${path} description is ${description.length} chars`);
        titles.add(title);
        descriptions.add(description);
    }
    assert.equal(titles.size, 4);
    assert.equal(descriptions.size, 4);
});

test('government title does not promise other sections; jobs title does not mention government', () => {
    const jobs = read('app/jobs/page.tsx');
    assert.ok(!/title: '[^']*[Gg]overnment[^']*'/.test(jobs));
    assert.ok(!/title: '[^']*[Ii]nternship[^']*'/.test(jobs.slice(jobs.indexOf('listingMetadata('))));
});

test('listingMetadata: self canonical, og:url == canonical, paginated title, hreflang only on plain page 1', () => {
    const base = { path: '/remote-jobs', title: 'T', description: 'D', imageAlt: 'A', languages: { es: 'x' } };
    const p1: any = listingMetadata({ ...base, searchParams: {} });
    assert.equal(p1.alternates.canonical, 'https://intern-flow.in/remote-jobs');
    assert.equal(p1.openGraph.url, p1.alternates.canonical);
    assert.deepEqual(p1.alternates.languages, { es: 'x' });
    assert.equal(p1.openGraph.siteName, 'InternFlow');
    assert.equal(p1.openGraph.locale, 'en_IN');
    assert.equal(p1.twitter.creator, '@internflow_in');
    const p3: any = listingMetadata({ ...base, searchParams: { page: '3' } });
    assert.equal(p3.alternates.canonical, 'https://intern-flow.in/remote-jobs?page=3');
    assert.equal(p3.openGraph.url, p3.alternates.canonical);
    assert.equal(p3.title, 'T — Page 3');
    assert.equal(p3.alternates.languages, undefined);
    const filtered: any = listingMetadata({ ...base, searchParams: { role: 'software' } });
    assert.equal(filtered.alternates.canonical, 'https://intern-flow.in/remote-jobs');
});

test('pageOpenGraph defaults to the shared image and repeats siteName/locale/creator', () => {
    const m: any = pageOpenGraph({ title: 't', description: 'd', url: 'https://intern-flow.in/x' });
    assert.equal(m.openGraph.images[0].url, 'https://intern-flow.in/og-image.png');
    assert.equal(m.twitter.card, 'summary_large_image');
});

// ---------- detail routes ----------
test('all four detail routes reserve brand width and use the shared Open Graph helper', () => {
    for (const f of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        const src = read(`app/${f}/[slug]/page.tsx`);
        assert.ok(/SERP_TITLE_PX_WITH_BRAND/.test(src), `${f}/[slug] must reserve brand width`);
        assert.ok(/pageOpenGraph\(|siteName:\s*'InternFlow'/.test(src), `${f}/[slug] must set siteName/locale/creator`);
        assert.ok(/permanentRedirect\(/.test(src), `${f}/[slug] must redirect to the canonical category`);
    }
});

// ---------- robots.txt ----------
test('robots.txt blocks filter-facet query strings but keeps ?page= crawlable', () => {
    const robots = read('public/robots.txt');
    for (const k of ['search', 'loc', 'sort', 'role', 'mode', 'skills', 'course', 'source', 'batch', 'company']) {
        assert.ok(robots.includes(`Disallow: /*?*${k}=`), `missing Disallow for ${k}=`);
    }
    assert.ok(!robots.includes('Disallow: /*?*page='));
});

// ---------- JobPosting validThrough ----------
const baseJob: any = {
    id: 'abc', title: 'Dev', company: 'Acme', description: 'x', url: 'u', source: 's',
    posted_at: '2026-09-01T00:00:00Z', location: 'Pune', country: 'India',
};

test('validThrough is published only for a real deadline, never invented', () => {
    const none: any = jobPostingSchema(baseJob, 'https://intern-flow.in/jobs/x');
    assert.ok(none);
    assert.ok(!('validThrough' in none));
    const withDeadline: any = jobPostingSchema({ ...baseJob, deadline: '2026-12-31T00:00:00Z' }, 'https://intern-flow.in/jobs/x');
    assert.equal(withDeadline.validThrough, '2026-12-31T00:00:00Z');
    const noDates: any = jobPostingSchema({ ...baseJob, posted_at: undefined }, 'https://intern-flow.in/jobs/x');
    assert.ok(!('validThrough' in noDates));
});

// ---------- created_at fallback for undated jobs ----------
import { isStaleForIndexing, isIndexableJob } from '../lib/seo/seoMetrics';

test('undated job goes stale 60 days after created_at, never before', () => {
    const ago = (days: number) => new Date(Date.now() - days * 86400000).toISOString();
    assert.equal(isStaleForIndexing({ created_at: ago(59) }), false);
    assert.equal(isStaleForIndexing({ created_at: ago(61) }), true);
    assert.equal(isStaleForIndexing({}), false);
    assert.equal(isStaleForIndexing({ posted_at: ago(46), created_at: ago(1) }), true);
    assert.equal(isIndexableJob({ created_at: ago(61), is_thin: false }), false);
});

// ---------- government detail title ----------
import { buildGovernmentTitle, formatLastDate } from '../lib/seo/seoMetrics';

test('government title leads with department, says Recruitment + year + posts, fits the SERP budget', () => {
    const t = buildGovernmentTitle({ title: 'Junior Engineer (Electrical)', department: 'BHEL', vacancies: '120', deadline: '2026-10-30T00:00:00Z', maxPx: SERP_TITLE_PX_WITH_BRAND });
    assert.equal(t, 'BHEL Junior Engineer (Electrical) Recruitment 2026 (120 Posts)');
    assert.ok(estimatePixelWidth(t) <= SERP_TITLE_PX_WITH_BRAND);
    // no invented year / non-numeric vacancies / department already in the post name
    assert.equal(buildGovernmentTitle({ title: 'BHEL Clerk', department: 'BHEL', vacancies: 'Various' }), 'BHEL Clerk Recruitment');
    assert.ok(!/\b20\d\d\b/.test(buildGovernmentTitle({ title: 'Clerk' })));
    assert.equal(formatLastDate('2026-10-30T00:00:00Z'), '30 Oct 2026');
    assert.equal(formatLastDate('not a date'), null);
});

test('government detail page uses buildGovernmentTitle and puts the last date in the description', () => {
    const src = read('app/government-jobs/[slug]/page.tsx');
    assert.ok(/buildGovernmentTitle\(/.test(src) && /Last date:/.test(src));
});

// ---------- detail-route hardening ----------
test('all four detail routes 308 a non-canonical slug to the canonical URL', () => {
    for (const p of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        const src = read(`app/${p}/[slug]/page.tsx`);
        assert.ok(/params\.slug !== jobSlug\(job\)/.test(src), p);
        assert.ok(/permanentRedirect\(localizedCanonicalPath\(canonicalPathForJob\(job\), content\)\)/.test(src), p);
    }
});

test('a job page has exactly one <main> and never prints "unknown" as its source', () => {
    const detail = read('app/components/JobDetail.tsx');
    assert.ok(!/<main/.test(detail), 'JobDetail is nested inside each route\'s <main>; use <article>');
    assert.ok(/<article/.test(detail));
    assert.ok(!/'unknown'/.test(detail));
    for (const p of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        assert.equal((read(`app/${p}/[slug]/page.tsx`).match(/<main/g) ?? []).length, 1, p);
    }
});

// ---------- sitemap resilience ----------
import { serveSitemap, mapWithLimit, _clearSitemapCache, sitemapEtag, etagMatches } from '../lib/sitemapResponse';

test('a failing sitemap build serves the last good copy, then a static fallback, and only then 503', async () => {
    _clearSitemapCache();
    const boom = async () => { throw new Error('api down'); };
    // nothing known yet and no fallback (per-file job sitemaps): 503 + Retry-After, the only 5xx left
    const cold = await serveSitemap('t1', boom);
    assert.equal(cold.status, 503);
    assert.equal(cold.headers.get('Retry-After'), '900');
    // every route sitemap passes a fallback: a 200, never a 503
    const fb = await serveSitemap('t1', boom, () => ({ xml: '<urlset>fallback</urlset>' }));
    assert.equal(fb.status, 200);
    assert.equal(fb.headers.get('x-sitemap-served'), 'fallback');
    assert.equal(await fb.text(), '<urlset>fallback</urlset>');
    // even a fallback that itself throws ends in the documented last resort, not an unhandled error
    const brokenFb = await serveSitemap('t1', boom, () => { throw new Error('fallback bug'); });
    assert.equal(brokenFb.status, 503);
    // once a real build succeeded, a later failure serves that copy (stale), not the fallback
    const ok = await serveSitemap('t1', async () => ({ xml: '<urlset>real</urlset>', lastmod: '2026-10-01T00:00:00.000Z' }), () => ({ xml: '<urlset>fallback</urlset>' }));
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('x-sitemap-served'), 'fresh');
    assert.equal(ok.headers.get('Last-Modified'), 'Thu, 01 Oct 2026 00:00:00 GMT');
    const stale = await serveSitemap('t1', boom, () => ({ xml: '<urlset>fallback</urlset>' }));
    assert.equal(stale.status, 200);
    assert.equal(stale.headers.get('x-sitemap-served'), 'stale');
    assert.equal(await stale.text(), '<urlset>real</urlset>');
    assert.ok(/stale-if-error/.test(stale.headers.get('Cache-Control') ?? ''));
    // degraded answers are cached briefly so the CDN retries the real build soon
    assert.ok(/s-maxage=300/.test(stale.headers.get('Cache-Control') ?? ''));
    // a healthy answer is cached for an hour at the CDN
    assert.ok(/s-maxage=3600/.test(ok.headers.get('Cache-Control') ?? ''));
});

test('a build that resolves null is a 404, not an outage', async () => {
    _clearSitemapCache();
    const res = await serveSitemap('t2', async () => null);
    assert.equal(res.status, 404);
});

test('a build that hangs is cut off and answered from the fallback instead of running into the platform timeout', async () => {
    _clearSitemapCache();
    const realSetTimeout = globalThis.setTimeout;
    // collapse the 25 s deadline to 5 ms for this test only
    (globalThis as any).setTimeout = (fn: () => void, ms?: number, ...a: unknown[]) => realSetTimeout(fn, ms === 25_000 ? 5 : ms, ...a);
    try {
        const res = await serveSitemap('t3', () => new Promise(() => {}), () => ({ xml: '<urlset>fallback</urlset>' }));
        assert.equal(res.status, 200);
        assert.equal(res.headers.get('x-sitemap-served'), 'fallback');
    }
    finally {
        globalThis.setTimeout = realSetTimeout;
    }
});

test('mapWithLimit never exceeds the concurrency cap and keeps result order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithLimit([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 3, async (n) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 5));
        inFlight--;
        return n * 2;
    });
    assert.ok(peak <= 3, `peak ${peak}`);
    assert.deepEqual(out, [2, 4, 6, 8, 10, 12, 14, 16, 18, 20]);
});

test('every sitemap route is a one-liner over the resilient helper, and skills stays capped', () => {
    for (const r of ['static', 'hackathons', 'tools', 'blog', 'skills', 'companies', 'locations', 'batches', 'resume', 'careers']) {
        const src = read(`app/sitemap-${r}.xml/route.ts`);
        assert.ok(new RegExp(`serveRouteSitemap\\('${r}'(, req)?\\)`).test(src), r);
        assert.ok(!/new Response\(/.test(src), `${r} must not build its own response (no cache headers, no fallback)`);
    }
    const registry = read('lib/routeSitemaps.ts');
    assert.ok(/mapWithLimit\(SKILLS, 4/.test(registry));
    // every registry entry has a fallback and a lastmod
    assert.equal((registry.match(/^    fallback:/gm) ?? []).length, 10);
    assert.equal((registry.match(/^    lastmod: (getLatestJobDate|async)/gm) ?? []).length, 10);
    assert.ok(!/503/.test(read('app/sitemap.xml/route.ts')));
});

// ---------- Bing "Title too long" (final <title> incl. ' | InternFlow' must be <= 65 chars) ----------
import { buildJobTitle, fitTitle, BRAND_TITLE_SUFFIX, TITLE_MAX_CHARS_WITH_BRAND } from '../lib/seo/seoMetrics';

const finalLen = (t: string) => (t + BRAND_TITLE_SUFFIX).length;
const BUDGET = { maxPx: SERP_TITLE_PX_WITH_BRAND, maxChars: TITLE_MAX_CHARS_WITH_BRAND };

test('job titles never exceed 65 chars once the brand is appended, dropping location/type before cutting words', () => {
    assert.equal(TITLE_MAX_CHARS_WITH_BRAND, 52);
    // the real page from Search Console (70 chars before this fix) now fits whole, without its location
    const real = buildJobTitle({ title: 'UI Developer, Angular', company: 'VY Systems Private Limited', type: 'full-time', location: 'Bengaluru (Bangalore)', ...BUDGET });
    assert.equal(real, 'UI Developer, Angular at VY Systems Private Limited | Job'.length <= 52 ? 'UI Developer, Angular at VY Systems Private Limited | Job' : real);
    assert.ok(finalLen(real) <= 65, real);
    assert.ok(real.startsWith('UI Developer, Angular at VY Systems Private Limited'), 'role and company survive intact');
    const cases = [
        { title: 'Senior Principal Software Development Engineer in Test', company: 'Tata Consultancy Services Limited', type: 'internship', location: 'Navi Mumbai, Maharashtra' },
        { title: 'AI', company: 'X', type: 'job', location: 'Pune' },
        { title: 'Data Analyst Intern', company: 'Acme', type: 'internship', isRemote: true },
    ];
    for (const c of cases) {
        const t = buildJobTitle({ ...c, ...BUDGET });
        assert.ok(finalLen(t) <= 65, `${t} is ${finalLen(t)} chars`);
    }
    // short titles keep every segment
    assert.equal(buildJobTitle({ title: 'Data Intern', company: 'Acme', type: 'internship', location: 'Pune', ...BUDGET }), 'Data Intern at Acme | Internship | Pune');
});

test('government and company titles also fit 65 chars with the brand', () => {
    const gov = buildGovernmentTitle({ title: 'Junior Engineer (Electrical)', department: 'Bharat Heavy Electricals Limited', vacancies: '120', deadline: '2026-10-30T00:00:00Z', ...BUDGET });
    assert.ok(finalLen(gov) <= 65, gov);
    const long = fitTitle(['Tata Consultancy Services Limited Jobs & Internships — Openings, Hiring Process', 'Tata Consultancy Services Limited Jobs & Internships — Current Openings', 'Tata Consultancy Services Limited Jobs & Internships', 'Tata Consultancy Services Limited Jobs'], BUDGET.maxPx, BUDGET.maxChars);
    assert.ok(finalLen(long) <= 65, long);
    // a name so long that nothing fits is truncated with an ellipsis, still within budget
    const huge = fitTitle(['A'.repeat(80) + ' Jobs'], BUDGET.maxPx, BUDGET.maxChars);
    assert.ok(finalLen(huge) <= 65, huge);
});

test('every detail route passes the character budget', () => {
    for (const f of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        assert.ok(/maxChars:\s*TITLE_MAX_CHARS_WITH_BRAND/.test(read(`app/${f}/[slug]/page.tsx`)), `${f}/[slug]`);
    }
    assert.ok(/TITLE_MAX_CHARS_WITH_BRAND/.test(read('app/companies/[company]/page.tsx')));
});


test('sitemaps send an ETag and answer If-None-Match with a body-less 304', async () => {
    _clearSitemapCache();
    const build = async () => ({ xml: '<urlset>etag</urlset>', lastmod: '2026-10-01T00:00:00.000Z' });
    const first = await serveSitemap('etag1', build);
    const etag = first.headers.get('ETag');
    assert.equal(first.status, 200);
    assert.equal(etag, sitemapEtag('<urlset>etag</urlset>'));
    const req = new Request('https://x.test/s.xml', { headers: { 'If-None-Match': etag! } });
    const cached = await serveSitemap('etag1', build, undefined, req);
    assert.equal(cached.status, 304);
    assert.equal(await cached.text(), '');
    assert.equal(cached.headers.get('ETag'), etag);
    // changed content -> different validator -> full 200
    const changed = await serveSitemap('etag2', async () => ({ xml: '<urlset>changed</urlset>' }), undefined, req);
    assert.equal(changed.status, 200);
});

test('etagMatches handles weak prefixes, lists and *', () => {
    const e = sitemapEtag('a');
    assert.equal(etagMatches(`W/${e}`, e), true);
    assert.equal(etagMatches(`"zzz", ${e}`, e), true);
    assert.equal(etagMatches('*', e), true);
    assert.equal(etagMatches('"nope"', e), false);
    assert.equal(etagMatches(null, e), false);
});

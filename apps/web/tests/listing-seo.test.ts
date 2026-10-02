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
    assert.ok((api.match(/is_government IS NOT TRUE/g) ?? []).length >= 3, 'list, featured and facet conditions must all exclude');
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

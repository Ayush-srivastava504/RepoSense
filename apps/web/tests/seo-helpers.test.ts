// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { salaryToBaseSalary } from '../lib/structuredData';
import { listPageState, paginatedCanonical, paginatedTitle } from '../lib/seo/pagination';
import { internalApiHeaders } from '../lib/internalApi';
import { getJobById, JobApiUnavailableError } from '../lib/jobs';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

// ---------- baseSalary ----------
test('salary: currency comes from the text, never assumed INR for foreign jobs', () => {
    assert.equal(salaryToBaseSalary('EUR 40000-60000', { country: 'Europe' })?.currency, 'EUR');
    assert.equal(salaryToBaseSalary('$120k per year', { country: 'US' })?.currency, 'USD');
    assert.equal(salaryToBaseSalary('¥400,000 per month', { country: 'Japan' })?.currency, 'JPY');
    // no currency marker + non-Indian country -> omit rather than guess INR
    assert.equal(salaryToBaseSalary('50000 per month', { country: 'Japan' }), null);
});

test('salary: LPA / lakh / k multipliers and ranges are applied', () => {
    const lpa = salaryToBaseSalary('8 LPA', { country: 'India' })!;
    assert.deepEqual(lpa.value, { '@type': 'QuantitativeValue', unitText: 'YEAR', value: 800000 });
    const range = salaryToBaseSalary('₹10-14 LPA')!;
    assert.equal(range.value.minValue, 1000000);
    assert.equal(range.value.maxValue, 1400000);
    assert.equal(salaryToBaseSalary('€45k per year')!.value.value, 45000);
    const monthly = salaryToBaseSalary('₹15,000 - ₹25,000 per month')!;
    assert.equal(monthly.value.minValue, 15000);
    assert.equal(monthly.value.unitText, 'MONTH');
});

test('salary: unknown period is omitted, except stipends (monthly) and large foreign annual figures', () => {
    assert.equal(salaryToBaseSalary('₹40,000'), null);
    assert.equal(salaryToBaseSalary('₹10,000', { isInternship: true })!.value.unitText, 'MONTH');
    assert.equal(salaryToBaseSalary('USD 50000-80000')!.value.unitText, 'YEAR');
    assert.equal(salaryToBaseSalary('Competitive'), null);
    assert.equal(salaryToBaseSalary(''), null);
    assert.equal(salaryToBaseSalary(undefined), null);
});

// ---------- pagination canonical ----------
const BASE = 'https://intern-flow.in';
test('pagination: page N is self-canonical; page 1 and filtered views use the base URL', () => {
    assert.equal(paginatedCanonical(BASE, '/jobs', {}), `${BASE}/jobs`);
    assert.equal(paginatedCanonical(BASE, '/jobs', { page: '1' }), `${BASE}/jobs`);
    assert.equal(paginatedCanonical(BASE, '/jobs', { page: '3' }), `${BASE}/jobs?page=3`);
    assert.equal(paginatedCanonical(BASE, '/jobs', { page: '3', role: 'software' }), `${BASE}/jobs`);
    assert.equal(paginatedCanonical(BASE, '/jobs', { page: 'abc' }), `${BASE}/jobs`);
    assert.equal(paginatedCanonical(BASE, '/jobs', { page: '-2' }), `${BASE}/jobs`);
    assert.deepEqual(listPageState({ page: '2', search: '' }), { page: 2, filtered: false });
    assert.equal(paginatedTitle('Jobs', 1), 'Jobs');
    assert.equal(paginatedTitle('Jobs', 4), 'Jobs — Page 4');
});

// ---------- internal API key ----------
test('internal key is attached only to API-bound requests and only when configured', () => {
    const api = 'https://api.intern-flow.in';
    assert.deepEqual(internalApiHeaders(`${api}/api/jobs/x`, { INTERNAL_API_KEY: 's3cret' }, api), { 'X-Internal-Key': 's3cret' });
    assert.deepEqual(internalApiHeaders(`${api}/api/jobs/x`, {}, api), {});
    assert.deepEqual(internalApiHeaders('https://evil.example/api', { INTERNAL_API_KEY: 's3cret' }, api), {});
});

// ---------- getJobById: only a real 404 is "not found" ----------
async function withFetch<T>(impl: typeof fetch, fn: () => Promise<T>): Promise<T> {
    const real = globalThis.fetch;
    globalThis.fetch = impl;
    try {
        return await fn();
    } finally {
        globalThis.fetch = real;
    }
}
const reply = (status: number, body: unknown = {}) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('getJobById: 200 -> job, 404 -> null', async () => {
    assert.equal((await withFetch(reply(200, { id: 'abc' }), () => getJobById('abc')))?.id, 'abc');
    assert.equal(await withFetch(reply(404), () => getJobById('abc')), null);
});

test('getJobById: 429, 5xx and network errors throw instead of producing a false 404', async () => {
    const quiet = console.error;
    console.error = () => {};
    try {
        for (const status of [429, 500, 503]) {
            await assert.rejects(() => withFetch(reply(status), () => getJobById('abc')), JobApiUnavailableError);
        }
        const boom = (async () => { throw new Error('ECONNRESET'); }) as unknown as typeof fetch;
        await assert.rejects(() => withFetch(boom, () => getJobById('abc')), JobApiUnavailableError);
    } finally {
        console.error = quiet;
    }
});

// ---------- static guards for the SEO fixes ----------
test('robots.txt does not block pagination or /_next/ assets, but still blocks search/loc/sort permutations', () => {
    const robots = read('public/robots.txt');
    assert.doesNotMatch(robots, /^Disallow:\s*\/_next\/?\s*$/m);
    assert.doesNotMatch(robots, /^Disallow:.*page=/m);
    for (const p of ['search=', 'loc=', 'sort=']) assert.match(robots, new RegExp(`^Disallow: /\\*\\?\\*${p}`, 'm'));
});

test('JobCard always links to the canonical path (no hardcoded category prefix)', () => {
    const card = read('app/components/JobCard.tsx');
    assert.match(card, /href=\{canonicalPathForJob\(job\)\}/);
    assert.doesNotMatch(card, /\$\{basePath\}/);
});

test('tool pages listed in sitemap-static each have their own canonical (not the homepage)', () => {
    for (const dir of ['ats-checker', 'cover-letter', 'github', 'linkedin', 'resume/builder']) {
        const layout = read(`app/(auth)/${dir}/layout.tsx`);
        assert.match(layout, new RegExp(`canonical: \`\\$\\{BASE_URL\\}/${dir.replace('/', '\\/')}\``), dir);
    }
});

test('job detail pages do not emit hreflang for untranslated English listings', () => {
    for (const dir of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        assert.doesNotMatch(read(`app/${dir}/[slug]/page.tsx`), /languageAlternates/, dir);
    }
});

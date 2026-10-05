import test from 'node:test';
import assert from 'node:assert/strict';
import { companyHref, jobAnchorText, jobHref, pickFreshJobs, pickHiringCompanies } from '../lib/footerHiring';
import type { Company } from '../lib/companies';
import type { Job } from '../lib/jobs';

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const co = (company: string, job_count: number, tier: Company['tier'] = 'top', last_posted_at?: string) =>
    ({ company, job_count, tier, last_posted_at }) as Company;
const job = (id: string, company: string, extra: Partial<Job> = {}) =>
    ({ id, title: `Engineer ${id}`, company, posted_at: daysAgo(1), description: 'd', url: 'u', source: 's', is_top_company: false, ...extra }) as Job;

test('hiring companies skip thin hubs (under 2 jobs) and duplicate slugs', () => {
    const r = pickHiringCompanies([co('Acme', 5), co('Thin', 1), co('acme', 9), co('Beta', 2)]);
    assert.deepEqual(r.map((c) => c.company).sort(), ['Acme', 'Beta']);
});

test('hiring companies: top and mass-hire lead, startups only fill, freshest first', () => {
    const r = pickHiringCompanies([
        co('StartupFresh', 4, 'startup', daysAgo(0)),
        co('OldTop', 10, 'top', daysAgo(20)),
        co('FreshMass', 3, 'mass_hire', daysAgo(1)),
    ]);
    assert.deepEqual(r.map((c) => c.company), ['FreshMass', 'OldTop', 'StartupFresh']);
});

test('hiring companies are capped', () => {
    const many = Array.from({ length: 50 }, (_, i) => co(`C${i}`, 5));
    assert.equal(pickHiringCompanies(many, 30).length, 30);
});

test('company href uses the same slug as the company page', () => {
    assert.equal(companyHref({ company: 'Societe Generale Global Solution Centre' }), '/companies/societe-generale-global-solution-centre');
    assert.equal(companyHref({ company: 'NTT DATA, Inc.' }), '/companies/ntt-data-inc');
});

test('fresh jobs: one per company, top companies first, noindex jobs dropped', () => {
    const jobs = [
        job('1', 'SmallCo'),
        job('2', 'Accenture', { is_top_company: true }),
        job('3', 'Accenture', { is_top_company: true }),
        job('4', 'ThinCo', { is_top_company: true, is_thin: true }),
        job('5', 'StaleCo', { is_top_company: true, posted_at: daysAgo(90) }),
        job('6', 'Google', { is_top_company: true }),
    ];
    const r = pickFreshJobs(jobs);
    assert.deepEqual(r.map((j) => j.id), ['2', '6', '1']);
});

test('fresh jobs: a thin job is kept once it has an enriched overview', () => {
    const r = pickFreshJobs([job('1', 'Acme', { is_thin: true, enriched_overview: 'real overview' })]);
    assert.equal(r.length, 1);
});

test('fresh jobs: India before remote/abroad, then capped', () => {
    const jobs = [
        job('abroad', 'A', { country: 'Germany' }),
        ...Array.from({ length: 10 }, (_, i) => job(`in${i}`, `Co${i}`, { country: 'India' })),
    ];
    const r = pickFreshJobs(jobs, 8);
    assert.equal(r.length, 8);
    assert.ok(r.every((j) => j.country === 'India'));
});

test('job links point at the canonical category path, never a redirecting one', () => {
    assert.ok(jobHref(job('abc', 'Acme', { type: 'internship' })).startsWith('/internships/'));
    assert.ok(jobHref(job('abc', 'Acme')).startsWith('/jobs/'));
    assert.ok(jobHref(job('abc', 'Acme', { is_remote: true })).startsWith('/remote-jobs/'));
});

test('anchor text is descriptive and long titles are trimmed on a word boundary', () => {
    assert.equal(jobAnchorText({ title: 'Software Engineer', company: 'Accenture' }), 'Software Engineer at Accenture');
    const long = jobAnchorText({ title: 'Associate Software Engineer Trainee Graduate Engineer Programme 2026 Batch', company: 'IBM' });
    assert.ok(long.endsWith('… at IBM'));
    assert.ok(!long.includes('  '));
});

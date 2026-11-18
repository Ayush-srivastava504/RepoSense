// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeCountryCode } from '../lib/country';
import { jobPostingSchema, eventSchema } from '../lib/structuredData';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

test('country: names, codes and location tails resolve to ISO-2', () => {
    assert.equal(normalizeCountryCode('India'), 'IN');
    assert.equal(normalizeCountryCode('in'), 'IN');
    assert.equal(normalizeCountryCode('Japan'), 'JP');
    assert.equal(normalizeCountryCode('USA'), 'US');
    assert.equal(normalizeCountryCode('UK'), 'GB');
    assert.equal(normalizeCountryCode('Berlin, Germany'), 'DE');
    assert.equal(normalizeCountryCode('Bengaluru, Karnataka, India'), 'IN');
});

test('country: regions, arrangements, ambiguous tails and junk are not countries', () => {
    for (const v of ['Europe', 'Worldwide', 'Remote', 'Anywhere', 'EU', 'XX', '', null, undefined, 'San Francisco, CA'])
        assert.equal(normalizeCountryCode(v as string), null, String(v));
});

const baseJob: any = {
    id: '0123456789abcdef',
    title: 'Backend Intern',
    company: 'Acme',
    description: 'x'.repeat(200),
    url: 'https://example.com/apply',
    source: 'test',
    posted_at: new Date().toISOString(),
};

test('jobPosting: remote job in \"Europe\"/\"Worldwide\" emits no schema (required applicantLocationRequirements cannot be stated)', () => {
    for (const country of ['Europe', 'Worldwide']) {
        assert.equal(jobPostingSchema({ ...baseJob, is_remote: true, country }, 'https://intern-flow.in/remote-jobs/x'), null, country);
    }
    const ok: any = jobPostingSchema({ ...baseJob, is_remote: true, country: 'Japan' }, 'https://intern-flow.in/remote-jobs/x');
    assert.equal(ok.jobLocationType, 'TELECOMMUTE');
    assert.deepEqual(ok.applicantLocationRequirements, { '@type': 'Country', name: 'JP' });
});

test('jobPosting: on-site job with no location and an unresolvable country emits no schema', () => {
    assert.equal(jobPostingSchema({ ...baseJob, country: 'Europe' }, 'https://intern-flow.in/jobs/x'), null);
    const blank: any = jobPostingSchema({ ...baseJob }, 'https://intern-flow.in/jobs/x');
    assert.equal(blank.jobLocation.address.addressCountry, 'IN');
});

test('event: no startDate, or offline with no location/country, emits no schema', () => {
    const base = { name: 'Hack', url: 'https://intern-flow.in/hackathons/h', isOnline: false };
    assert.equal(eventSchema({ ...base, location: 'Pune' }), null);
    assert.equal(eventSchema({ ...base, startDate: '2026-12-01' }), null);
    assert.ok(eventSchema({ ...base, startDate: '2026-12-01', location: 'Pune' }));
    assert.ok(eventSchema({ ...base, startDate: '2026-12-01', isOnline: true }));
});

test('jobPosting: on-site addressCountry is an ISO code, omitted when the column holds a location', () => {
    const india: any = jobPostingSchema({ ...baseJob, location: 'Pune', country: 'India' }, 'https://intern-flow.in/jobs/x');
    assert.equal(india.jobLocation.address.addressCountry, 'IN');
    const blank: any = jobPostingSchema({ ...baseJob, location: 'Pune' }, 'https://intern-flow.in/jobs/x');
    assert.equal(blank.jobLocation.address.addressCountry, 'IN'); // long-standing default for a blank column
    const city: any = jobPostingSchema({ ...baseJob, location: 'Austin', country: 'Austin, TX' }, 'https://intern-flow.in/jobs/x');
    assert.equal('addressCountry' in city.jobLocation.address, false);
});

test('robots.txt: old locale prefixes stay crawlable so Googlebot can see their 301 to English', () => {
    const robots = read('public/robots.txt');
    // middleware.ts 301s every /es/..., /ja/... URL to the English page. A Disallow would hide
    // that redirect and leave the duplicates stuck in the index as "Blocked by robots.txt".
    assert.ok(!/^(Allow|Disallow): \/(es|ja|fr|de|pt|ko|it|hi)\//m.test(robots));
    // The abroad hubs are gone (redirected in next.config.js).
    assert.ok(!/\/(japan|europe)-jobs/.test(robots));
});

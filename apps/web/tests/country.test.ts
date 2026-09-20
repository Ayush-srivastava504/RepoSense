// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { normalizeCountryCode } from '../lib/country';
import { jobPostingSchema } from '../lib/structuredData';

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

test('jobPosting: remote job in "Europe"/"Worldwide" gets no bogus applicantLocationRequirements', () => {
    for (const country of ['Europe', 'Worldwide']) {
        const s: any = jobPostingSchema({ ...baseJob, is_remote: true, country }, 'https://intern-flow.in/remote-jobs/x');
        assert.equal(s.jobLocationType, 'TELECOMMUTE');
        assert.equal(s.applicantLocationRequirements, undefined, country);
    }
    const ok: any = jobPostingSchema({ ...baseJob, is_remote: true, country: 'Japan' }, 'https://intern-flow.in/remote-jobs/x');
    assert.deepEqual(ok.applicantLocationRequirements, { '@type': 'Country', name: 'JP' });
});

test('jobPosting: on-site addressCountry is an ISO code, omitted when the column holds a location', () => {
    const india: any = jobPostingSchema({ ...baseJob, location: 'Pune', country: 'India' }, 'https://intern-flow.in/jobs/x');
    assert.equal(india.jobLocation.address.addressCountry, 'IN');
    const blank: any = jobPostingSchema({ ...baseJob, location: 'Pune' }, 'https://intern-flow.in/jobs/x');
    assert.equal(blank.jobLocation.address.addressCountry, 'IN'); // long-standing default for a blank column
    const city: any = jobPostingSchema({ ...baseJob, location: 'Austin', country: 'Austin, TX' }, 'https://intern-flow.in/jobs/x');
    assert.equal('addressCountry' in city.jobLocation.address, false);
});

test('robots.txt: locale-prefixed job DETAIL pages are not crawled, locale list pages still are', () => {
    const robots = read('public/robots.txt');
    for (const loc of ['es', 'ja', 'fr', 'de', 'pt', 'ko', 'it', 'hi'])
        for (const cat of ['jobs', 'internships', 'remote-jobs', 'government-jobs'])
            assert.ok(robots.includes(`Disallow: /${loc}/${cat}/\n`), `${loc}/${cat}`);
    // The trailing slash is what keeps /es/jobs (the hreflang-linked list page) crawlable.
    assert.ok(!/Disallow: \/(es|ja|fr|de|pt|ko|it|hi)\/(jobs|internships|remote-jobs|government-jobs)\s*$/m.test(robots));
});

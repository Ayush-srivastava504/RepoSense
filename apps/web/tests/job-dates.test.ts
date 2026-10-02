// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
// Guards the "Recently" bug: jobs with posted_at NULL must still show a real date, and the
// visible date must be the same one the JobPosting JSON-LD publishes as datePosted.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { jobPostedDate, jobDatePosted, formatPostedDate } from '../lib/jobDates';
import { jobPostingSchema } from '../lib/structuredData';
import { timeAgo } from '../lib/timeAgo';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

test('jobPostedDate: prefers posted_at, falls back to created_at', () => {
    assert.equal(jobPostedDate({ posted_at: '2026-09-01T10:00:00Z', created_at: '2026-09-20T10:00:00Z' }), '2026-09-01T10:00:00Z');
    assert.equal(jobPostedDate({ posted_at: null, created_at: '2026-09-20T10:00:00Z' }), '2026-09-20T10:00:00Z');
    assert.equal(jobPostedDate({ created_at: '2026-09-20T10:00:00Z' }), '2026-09-20T10:00:00Z');
});

test('jobPostedDate: never shows last_seen_at (it moves on every crawl)', () => {
    assert.equal(jobPostedDate({ posted_at: null, created_at: null, last_seen_at: '2026-10-03T00:00:00Z' }), undefined);
});

test('jobPostedDate: ignores empty / unparseable values instead of rendering "Invalid Date"', () => {
    assert.equal(jobPostedDate({ posted_at: '', created_at: 'not-a-date' }), undefined);
    assert.equal(jobPostedDate({ posted_at: 'garbage', created_at: '2026-09-20T10:00:00Z' }), '2026-09-20T10:00:00Z');
});

test('jobDatePosted (schema): same as visible date, plus last_seen_at as last resort', () => {
    assert.equal(jobDatePosted({ posted_at: null, created_at: '2026-09-20T10:00:00Z' }), '2026-09-20T10:00:00Z');
    assert.equal(jobDatePosted({ last_seen_at: '2026-10-03T00:00:00Z' }), '2026-10-03T00:00:00Z');
    assert.equal(jobDatePosted({}), undefined);
});

test('formatPostedDate: fixed format, UTC, unambiguous', () => {
    assert.equal(formatPostedDate('2026-10-03T12:00:00Z'), '3 Oct 2026');
    // 23:30 UTC must stay on the 3rd regardless of the server timezone
    assert.equal(formatPostedDate('2026-10-03T23:30:00Z'), '3 Oct 2026');
    assert.equal(formatPostedDate('2026-01-05T00:00:00Z'), '5 Jan 2026');
});

test('visible date and JSON-LD datePosted agree for a job with posted_at NULL', () => {
    const job: any = {
        id: 'abc1', title: 'Software Intern', company: 'Acme', type: 'internship',
        description: 'x', url: 'https://example.test', source: 'test',
        posted_at: null, created_at: '2026-09-20T10:00:00.000Z',
    };
    const schema = jobPostingSchema(job, 'https://intern-flow.in/internships/software-intern-acme-abc1')!;
    assert.equal(schema.datePosted, jobPostedDate(job));
    assert.equal(schema.datePosted, '2026-09-20T10:00:00.000Z');
});

test('regression: no UI component prints a vague "Recent(ly)" for a missing date', () => {
    assert.ok(!/'Recent'/.test(read('app/components/JobDetail.tsx')));
    assert.ok(!/timeAgo\(job\.posted_at\)/.test(read('app/components/JobCard.tsx')));
    assert.ok(/jobPostedDate/.test(read('app/components/JobCard.tsx')));
    assert.ok(/jobPostedDate/.test(read('app/components/JobDetail.tsx')));
    assert.ok(/jobDatePosted/.test(read('lib/structuredData.ts')));
});

test('timeAgo still works on the resolved date', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000 - 60000).toISOString();
    assert.equal(timeAgo(jobPostedDate({ posted_at: null, created_at: twoDaysAgo })), 'Posted 2 days ago');
});

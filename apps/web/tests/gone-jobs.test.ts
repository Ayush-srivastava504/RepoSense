// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
//
// Updated for the shared gone-ids cache: goneJobs.ts used to call
// GET /api/jobs/{id}/status per job with a 5-min per-id cache; it now calls
// GET /api/jobs/gone-ids once and checks a shared Set with a 10-min TTL (see
// lib/goneJobs.ts and services/api/src/routes/jobs.py's /gone-ids route).
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearGoneJobCache, isJobGone, jobIdFromDetailPath } from '../lib/goneJobs';

const ID = '0123456789abcdef';
const OTHER_ID = 'fedcba9876543210';
const reply = (status: number, body: unknown = {}) =>
    (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

test('extracts the id from all four job detail routes', () => {
    for (const base of ['jobs', 'internships', 'remote-jobs', 'government-jobs']) {
        assert.equal(jobIdFromDetailPath(`/${base}/software-engineer-acme-pune-${ID}`), ID);
    }
    assert.equal(jobIdFromDetailPath(`/jobs/x-${ID}/`), ID);
});

test('ignores listing pages, other routes and non-hex ids', () => {
    assert.equal(jobIdFromDetailPath('/jobs'), null);
    assert.equal(jobIdFromDetailPath('/jobs/'), null);
    assert.equal(jobIdFromDetailPath(`/blog/post-${ID}`), null);
    assert.equal(jobIdFromDetailPath(`/jobs/${ID}/extra`), null);
    assert.equal(jobIdFromDetailPath('/jobs/software-engineer-acme'), null);
    assert.equal(jobIdFromDetailPath('/jobs/x-hk_0123456789abcdef'), null);
});

test('id present in the bulk list -> gone; absent -> not gone', async () => {
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(200, { ids: [ID] })), true);
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(200, { ids: [OTHER_ID] })), false);
});

test('5xx fails open to false', async () => {
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(503)), false);
});

test('network error fails open to false', async () => {
    clearGoneJobCache();
    const boom = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    assert.equal(await isJobGone(ID, boom), false);
});

test('one shared fetch serves every job id, cached across the 10-min TTL', async () => {
    clearGoneJobCache();
    let calls = 0;
    const f = (async () => { calls++; return new Response(JSON.stringify({ ids: [ID] })); }) as unknown as typeof fetch;
    const t0 = 1_000_000;
    await isJobGone(ID, f, t0);
    await isJobGone(OTHER_ID, f, t0 + 60_000);
    await isJobGone(ID, f, t0 + 5 * 60_000);
    assert.equal(calls, 1);
    await isJobGone(ID, f, t0 + 11 * 60_000); // past the 10-min TTL
    assert.equal(calls, 2);
});

test('a failed refresh is not cached -- the next call retries', async () => {
    clearGoneJobCache();
    let calls = 0;
    const f = (async () => { calls++; throw new Error('down'); }) as unknown as typeof fetch;
    const t0 = 1_000_000;
    await isJobGone(ID, f, t0);
    await isJobGone(ID, f, t0 + 1);
    assert.equal(calls, 2);
});

test('concurrent lookups share one in-flight fetch', async () => {
    clearGoneJobCache();
    let calls = 0;
    const f = (async () => { calls++; return new Response(JSON.stringify({ ids: [ID] })); }) as unknown as typeof fetch;
    const t0 = 1_000_000;
    const [a, b] = await Promise.all([isJobGone(ID, f, t0), isJobGone(OTHER_ID, f, t0)]);
    assert.equal(a, true);
    assert.equal(b, false);
    assert.equal(calls, 1);
});

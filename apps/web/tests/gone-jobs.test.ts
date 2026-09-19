// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { clearGoneJobCache, isJobGone, jobIdFromDetailPath } from '../lib/goneJobs';

const ID = '0123456789abcdef';
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

test('state=gone -> true, state=active -> false', async () => {
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(200, { state: 'gone' })), true);
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(200, { state: 'active' })), false);
});

test('404 (never existed) and 5xx fail open to false', async () => {
    clearGoneJobCache();
    assert.equal(await isJobGone(ID, reply(404)), false);
    assert.equal(await isJobGone(ID, reply(503)), false);
});

test('network error fails open to false', async () => {
    clearGoneJobCache();
    const boom = (async () => { throw new Error('down'); }) as unknown as typeof fetch;
    assert.equal(await isJobGone(ID, boom), false);
});

test('result is cached, then expires', async () => {
    clearGoneJobCache();
    let calls = 0;
    const f = (async () => { calls++; return new Response(JSON.stringify({ state: 'gone' })); }) as unknown as typeof fetch;
    const t0 = 1_000_000;
    await isJobGone(ID, f, t0);
    await isJobGone(ID, f, t0 + 60_000);
    assert.equal(calls, 1);
    await isJobGone(ID, f, t0 + 6 * 60_000);
    assert.equal(calls, 2);
});

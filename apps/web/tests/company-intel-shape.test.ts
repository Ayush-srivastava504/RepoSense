// Regression: /companies/[company] returned 500 when the API handed back odd shapes (jsonb as text,
// null arrays, missing facts.experience). The normalizers must absorb all of them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeIntel, normalizeProfile } from '../lib/companies';

test('normalizeIntel tolerates text jsonb, null arrays and junk topics', () => {
    const intel = normalizeIntel({
        slug: 'acme', name: 'Acme', job_count: '3',
        topics: [
            { topic_key: 'overview', title: 'What Acme does', body: 'Body', bullets: '["a","a","b"]', source_urls: null },
            { topic_key: 'bad', title: 'x', body: null, bullets: [], source_urls: [] },
            { topic_key: 'tech', body: 'Tech body', bullets: { not: 'a list' }, source_urls: ['https://acme.com/t'] },
            null,
        ],
    });
    assert.ok(intel);
    assert.equal(intel!.job_count, 3);
    assert.equal(intel!.topics.length, 2);
    assert.deepEqual(intel!.topics[0].bullets, ['a', 'b']);
    assert.deepEqual(intel!.topics[0].source_urls, []);
    assert.deepEqual(intel!.topics[1].bullets, []);
    assert.equal(intel!.topics[1].title, 'tech');
});

test('normalizeIntel rejects payloads without slug/name', () => {
    assert.equal(normalizeIntel(null), null);
    assert.equal(normalizeIntel({ name: 'x' }), null);
});

test('normalizeProfile fills missing facts instead of leaving undefined', () => {
    const p = normalizeProfile({ company: 'Acme', overview: 'o', facts: '{"active_listings":2,"locations":[{"name":"Pune","count":2}]}' });
    assert.ok(p);
    assert.equal(p!.facts.experience, null);
    assert.deepEqual(p!.facts.work_modes, {});
    assert.deepEqual(p!.facts.skills, []);
    assert.equal(p!.facts.locations[0].name, 'Pune');
});

test('normalizeProfile returns null for no overview or unusable facts', () => {
    assert.equal(normalizeProfile({ company: 'A', overview: '', facts: {} }), null);
    assert.equal(normalizeProfile({ company: 'A', overview: 'x', facts: null }), null);
    assert.equal(normalizeProfile({ company: 'A', overview: 'x', facts: 'not json' }), null);
});

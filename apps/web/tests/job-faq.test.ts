import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJobFaq } from '../lib/jobFaq';
import type { Job } from '../lib/jobs';

const base = { id: 'j1', title: 'Application Security Engineer', company: 'Acme', url: 'https://acme.com/apply', apply_domain: 'acme.com' } as unknown as Job;

test('every FAQ item has a non-empty answer and facts are only used when present', () => {
    const faq = buildJobFaq({ ...base, salary: '12-22 LPA', required_skills: ['SAST', 'DAST'], allowed_degrees: ['DEGREE'], allowed_passout_years: [2025, 2026], work_mode: 'ONSITE', location: 'Hyderabad' } as unknown as Job);
    assert.ok(faq.length >= 5);
    for (const f of faq) assert.ok(f.question.endsWith('?') && f.answer.length > 20, f.question);
    assert.ok(faq.some((f) => f.answer.includes('12-22 LPA')));
    assert.ok(faq.some((f) => f.answer.includes('SAST, DAST')));
});

test('no invented eligibility or skills when the job has none; compensation says not stated', () => {
    const faq = buildJobFaq(base);
    assert.ok(!faq.some((f) => f.question.startsWith('Who can apply')));
    assert.ok(!faq.some((f) => f.question.includes('skills does')));
    assert.ok(faq.some((f) => /not stated compensation/.test(f.answer)));
});

test('table_only tier gets no FAQ; AI faqs are merged and deduped; capped at 8', () => {
    assert.deepEqual(buildJobFaq({ ...base, content_tier: 'table_only' } as Job), []);
    const ai = Array.from({ length: 10 }, (_, i) => ({ q: `What is topic ${i} like at Acme?`, a: `Answer number ${i} for this listing.` }));
    const faq = buildJobFaq({ ...base, enriched_sections: { faqs: [{ q: 'How do I apply for the Application Security Engineer role?', a: 'dupe' }, ...ai] } } as Job);
    assert.equal(faq.length, 8);
    assert.equal(faq.filter((f) => /^How do I apply/.test(f.question)).length, 1);
});

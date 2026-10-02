import test from 'node:test';
import assert from 'node:assert/strict';
import { usableLogoDomain } from '../lib/logoDomain';

test('logoDomain: job boards and ATS hosts are never used as a company logo', () => {
    for (const d of ['linkedin.com', 'www.linkedin.com', 'in.linkedin.com', 'https://naukri.com/x', 'boards.greenhouse.io', 'jobs.lever.co', 'acme.myworkdayjobs.com', 'forms.gle'])
        assert.equal(usableLogoDomain(d), undefined, d);
});

test('logoDomain: real employer domains pass through normalised', () => {
    assert.equal(usableLogoDomain('google.com'), 'google.com');
    assert.equal(usableLogoDomain('www.Razorpay.com'), 'razorpay.com');
    assert.equal(usableLogoDomain('notlinkedin.com'), 'notlinkedin.com');
});

test('logoDomain: empty / malformed -> undefined (letter avatar)', () => {
    for (const d of [undefined, null, '', '  ', 'localhost'])
        assert.equal(usableLogoDomain(d as any), undefined);
});

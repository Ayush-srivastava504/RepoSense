import test from 'node:test';
import assert from 'node:assert/strict';
import { itemListSchema, faqSchema, safeJsonLd } from '../lib/structuredData';
import { directoryLabel } from '../lib/companies';
import { companyIsThin } from '../lib/seo/hubThresholds';
import { truncateTitleForSerp } from '../lib/seo/seoMetrics';
import { companyOgImageUrl } from '../lib/seo/ogImage';

test('itemListSchema numbers entries from startPosition and counts them', () => {
    const s = itemListSchema('Companies A', [{ name: 'Acme', url: 'https://x/a' }, { name: 'Apex', url: 'https://x/b' }], 101);
    assert.equal(s.numberOfItems, 2);
    assert.deepEqual(s.itemListElement.map((i) => i.position), [101, 102]);
    assert.equal(s['@type'], 'ItemList');
});

test('directoryLabel', () => {
    assert.equal(directoryLabel('a'), 'A');
    assert.equal(directoryLabel('0-9'), '0-9');
    assert.equal(directoryLabel('other'), 'Other');
});

test('company title is pixel-truncated for very long names', () => {
    const long = `${'International Business Machines Corporation of Somewhere '.repeat(2)}Jobs & Internships — Openings, Hiring Process`;
    const t = truncateTitleForSerp(long);
    assert.ok(t.length < long.length && t.endsWith('…'));
    assert.equal(truncateTitleForSerp('Acme Jobs & Internships — Current Openings'), 'Acme Jobs & Internships — Current Openings');
});

test('thin gate: 1 job + 5 topics is indexable, 1 job + 4 topics is not', () => {
    assert.equal(companyIsThin(1, false, 5), false);
    assert.equal(companyIsThin(1, false, 4), true);
    assert.equal(companyIsThin(2, false, 0), false);
});

test('faqSchema + safeJsonLd escape angle brackets; company og url shape', () => {
    const json = safeJsonLd(faqSchema([{ question: 'Is it <b>ok</b>?', answer: 'Yes.' }]));
    assert.ok(!json.includes('<b>'));
    assert.equal(companyOgImageUrl('acme').endsWith('/og/company/acme.png'), true);
});

import { companyOrganizationSchema } from '../lib/structuredData';

test('company Organization schema never carries a favicon-service logo', () => {
    const s = companyOrganizationSchema({ name: 'Acme', pageUrl: 'https://x/companies/acme', officialDomain: 'acme.com', isOfficialDomain: true, description: 'Acme builds things.' }) as Record<string, unknown>;
    assert.equal('logo' in s, false);
    assert.equal(s.url, 'https://acme.com');
    assert.equal(s.description, 'Acme builds things.');
});

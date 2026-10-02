// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
// Pins the SEO fixes on /internships and /internships/[slug].
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    buildJobTitle, estimatePixelWidth, BRAND_TITLE_SUFFIX, SERP_TITLE_PX_WITH_BRAND,
} from '../lib/seo/seoMetrics';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

const LONG = {
    title: 'Senior Backend Software Engineering Intern (Distributed Systems)',
    company: 'International Business Machines Corporation',
    type: 'internship',
    location: 'Bengaluru, Karnataka',
};

// ---------- <title> must fit AFTER the layout appends " | InternFlow" ----------
test('layout title template and BRAND_TITLE_SUFFIX stay in sync', () => {
    assert.ok(read('app/layout.tsx').includes(`'%s${BRAND_TITLE_SUFFIX}'`),
        'app/layout.tsx title.template no longer matches BRAND_TITLE_SUFFIX in lib/seo/seoMetrics.ts');
});

test('buildJobTitle without maxPx is unchanged (other routes keep their behaviour)', () => {
    const t = buildJobTitle(LONG);
    assert.ok(estimatePixelWidth(t) <= 580);
});

test('buildJobTitle with SERP_TITLE_PX_WITH_BRAND leaves room for the brand suffix', () => {
    const t = buildJobTitle({ ...LONG, maxPx: SERP_TITLE_PX_WITH_BRAND });
    assert.ok(estimatePixelWidth(t + BRAND_TITLE_SUFFIX) <= 580,
        `final <title> is ${estimatePixelWidth(t + BRAND_TITLE_SUFFIX)}px, over the 580px SERP budget`);
});

test('a short title is not truncated at all', () => {
    const t = buildJobTitle({ title: 'Data Intern', company: 'Acme', type: 'internship', location: 'Pune', maxPx: SERP_TITLE_PX_WITH_BRAND });
    assert.equal(t, 'Data Intern at Acme | Internship | Pune');
});

test('internship detail page reserves the brand width', () => {
    assert.ok(/maxPx:\s*SERP_TITLE_PX_WITH_BRAND/.test(read('app/internships/[slug]/page.tsx')));
});

// ---------- Open Graph ----------
test('listing page sets its own openGraph + twitter via the shared helper (no longer inherits the homepage URL/title)', () => {
    const src = read('app/internships/page.tsx');
    assert.ok(/listingMetadata\(/.test(src));
    const helper = read('lib/seo/pageMeta.ts');
    assert.ok(/openGraph:\s*\{/.test(helper));
    assert.ok(/twitter:\s*\{/.test(helper));
    assert.ok(/url:\s*canonical/.test(helper), 'og:url must equal the canonical URL');
    assert.ok(/siteName:\s*OG_SITE_NAME/.test(helper) && /OG_SITE_NAME\s*=\s*'InternFlow'/.test(helper));
});

test('detail page keeps og:site_name / og:locale / twitter creator that a page-level openGraph would drop', () => {
    // The internship detail route builds its openGraph/twitter through pageOpenGraph(), which sets all three.
    const src = read('app/internships/[slug]/page.tsx');
    assert.ok(/pageOpenGraph\(/.test(src));
    const helper = read('lib/seo/pageMeta.ts');
    assert.ok(/siteName:\s*OG_SITE_NAME/.test(helper) && /OG_SITE_NAME\s*=\s*'InternFlow'/.test(helper));
    assert.ok(/locale:\s*OG_LOCALE/.test(helper) && /OG_LOCALE\s*=\s*'en_IN'/.test(helper));
    assert.ok(/creator:\s*TWITTER_CREATOR/.test(helper) && /TWITTER_CREATOR\s*=\s*'@internflow_in'/.test(helper));
});

// ---------- JSON-LD ----------
test('listing JSON-LD goes through safeJsonLd (escapes "<"), like the detail page', () => {
    const src = read('app/internships/page.tsx');
    assert.ok(!/__html:\s*JSON\.stringify/.test(src));
    assert.equal((src.match(/__html:\s*safeJsonLd\(/g) ?? []).length, 2);
});

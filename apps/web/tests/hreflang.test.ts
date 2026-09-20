// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { HREFLANG_ENABLED, hreflangLinks } from '../lib/hreflang';
import { buildUrlsetXml } from '../lib/sitemapXml';
import { languageAlternates } from '../lib/structuredData';

const read = (rel: string) => readFileSync(resolve(__dirname, '..', rel), 'utf8');

test('hreflang: off, because every locale page canonicalises to English', () => {
    assert.equal(HREFLANG_ENABLED, false);
    assert.deepEqual(hreflangLinks('/jobs'), []);
    assert.deepEqual(languageAlternates('/jobs'), {});
    assert.deepEqual(languageAlternates('/'), {});
});

test('hreflang: sitemap of hubs is a plain urlset (no xhtml namespace) while off', () => {
    const xml = buildUrlsetXml([{ loc: 'https://intern-flow.in/jobs', changefreq: 'daily', priority: 0.9, alternates: hreflangLinks('/jobs') }]);
    assert.ok(!xml.includes('xhtml'), xml);
    assert.ok(xml.includes('<loc>https://intern-flow.in/jobs</loc>'));
});

test('hreflang: when enabled the full cluster is built, incl. x-default and self', () => {
    const links = hreflangLinks('/jobs', true);
    assert.equal(links.length, 10);
    assert.deepEqual(links.find((l) => l.lang === 'en'), { lang: 'en', href: 'https://intern-flow.in/jobs' });
    assert.deepEqual(links.find((l) => l.lang === 'es'), { lang: 'es', href: 'https://intern-flow.in/es/jobs' });
    assert.deepEqual(links.find((l) => l.lang === 'x-default'), { lang: 'x-default', href: 'https://intern-flow.in/jobs' });
    assert.equal(hreflangLinks('/', true).find((l) => l.lang === 'fr')!.href, 'https://intern-flow.in/fr');
});

test('hreflang: no route or page builds its own locale alternates outside lib/hreflang.ts', () => {
    for (const f of ['app/sitemap-static.xml/route.ts', 'app/sitemap-blog.xml/route.ts', 'app/blog/[slug]/page.tsx'])
        assert.doesNotMatch(read(f), /i18n\.locales/, f);
});

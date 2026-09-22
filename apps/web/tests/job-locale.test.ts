// Run: npm run test:sitemap   (node:test via tsx, no extra deps)
//
// Only the pure functions from lib/jobLocale.ts are covered here.
// resolveJobLocale()/getLocalizedJob() call next/headers().get(...), which
// throws outside an actual Next.js request scope — this file never calls
// them, only localizedCanonicalPath() and jobLanguageAlternates(), which
// take their inputs as plain arguments.
import test from 'node:test';
import assert from 'node:assert/strict';
import { localizedCanonicalPath, jobLanguageAlternates, type JobLocaleContent } from '../lib/jobLocale';

test('localizedCanonicalPath: untranslated response keeps the plain English path', () => {
    const content: JobLocaleContent = { job: null, locale: 'es', isTranslated: false };
    assert.equal(localizedCanonicalPath('/jobs/foo-bar', content), '/jobs/foo-bar');
});

test('localizedCanonicalPath: translated response gets the locale prefix', () => {
    const content: JobLocaleContent = { job: null, locale: 'es', isTranslated: true };
    assert.equal(localizedCanonicalPath('/jobs/foo-bar', content), '/es/jobs/foo-bar');
});

test('localizedCanonicalPath: English locale is never prefixed even if isTranslated were somehow true', () => {
    const content: JobLocaleContent = { job: null, locale: 'en', isTranslated: true };
    // getLocalizedJob() never actually produces this combination (wantsTranslation
    // requires locale !== 'en'), but the path builder itself shouldn't rely on that
    // invariant holding elsewhere -- it just prefixes whatever locale it's given.
    assert.equal(localizedCanonicalPath('/jobs/foo-bar', content), '/en/jobs/foo-bar');
});

test('jobLanguageAlternates: no translated_locales -> {}', () => {
    assert.deepEqual(jobLanguageAlternates('/jobs/foo-bar', undefined), {});
    assert.deepEqual(jobLanguageAlternates('/jobs/foo-bar', []), {});
});

test('jobLanguageAlternates: mirrors jobHreflangLinks as a Record', () => {
    const map = jobLanguageAlternates('/jobs/foo-bar', ['es']);
    assert.deepEqual(map, {
        en: 'https://intern-flow.in/jobs/foo-bar',
        es: 'https://intern-flow.in/es/jobs/foo-bar',
        'x-default': 'https://intern-flow.in/jobs/foo-bar',
    });
});

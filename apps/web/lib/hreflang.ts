// Module: lib/hreflang.ts
// Single switch + builder for every hreflang signal the site emits (page
// <link rel="alternate">, sitemap <xhtml:link>).
//
// WHY IT IS OFF: hreflang only works when every listed alternate is a real,
// self-canonical page in its own language. Here /es/jobs, /fr/blog, ... render
// the same English content under a translated UI shell (162 dictionary
// strings) and EVERY page declares its canonical as the English URL. So Google
// was being told "/es/jobs is the Spanish version" by hreflang and "/es/jobs is
// a duplicate of /jobs" by the canonical -- contradictory, so hreflang is
// ignored, and ~9 URLs per page were advertised for nothing while thousands of
// real listings wait at "Discovered - currently not indexed".
//
// TO TURN IT BACK ON: ship genuinely translated page content AND make each
// locale page self-canonical (canonical = its own /xx/... URL). Then set this
// to true; nothing else needs to change.

import { i18n } from '../i18n/config';
import { BASE_URL } from './site';

export const HREFLANG_ENABLED = false;

export interface HreflangLink {
    lang: string;
    href: string;
}

/** hreflang links (incl. x-default) for a site-relative path, or [] when disabled. */
export function hreflangLinks(path: string, enabled: boolean = HREFLANG_ENABLED): HreflangLink[] {
    if (!enabled)
        return [];
    const clean = path === '/' ? '' : path;
    const links: HreflangLink[] = i18n.locales.map((loc: string) => ({
        lang: loc,
        href: loc === i18n.defaultLocale ? `${BASE_URL}${clean}` : `${BASE_URL}/${loc}${clean}`,
    }));
    links.push({ lang: 'x-default', href: `${BASE_URL}${clean}` });
    return links;
}

// Locales the job-translation pipeline can actually produce content for
// (migrations/024_job_translations.sql, IMPLEMENTATION_PLAN.md §7). Kept
// in sync by hand with TRANSLATION_LOCALES in
// services/api/src/services/translation_enrichment_service.py — both are
// small, deliberate starting lists (es + pt as of Session 6), not the
// full 9-locale i18n/config.ts set.
export const TRANSLATABLE_LOCALES = ['es', 'pt'];

/**
 * Job-detail hreflang, independent of the site-wide HREFLANG_ENABLED flag
 * above (which is off because /es/jobs etc. render untranslated English
 * content under a translated chrome — a real problem for hub/list pages).
 * A job page is different: it only advertises a locale when that specific
 * job has a real job_translations row for it (job.translated_locales,
 * from GET /api/jobs/{id}), so unlike the site-wide case, canonical and
 * hreflang never contradict each other here — a locale either has real
 * translated content and is genuinely self-canonical at its own URL, or
 * it's simply not advertised and the page keeps canonicalizing to
 * English, same as today.
 */
export function jobHreflangLinks(path: string, translatedLocales: string[]): HreflangLink[] {
    const available = translatedLocales.filter((l) => TRANSLATABLE_LOCALES.includes(l));
    if (available.length === 0)
        return [];
    const links: HreflangLink[] = [{ lang: i18n.defaultLocale, href: `${BASE_URL}${path}` }];
    for (const loc of available)
        links.push({ lang: loc, href: `${BASE_URL}/${loc}${path}` });
    links.push({ lang: 'x-default', href: `${BASE_URL}${path}` });
    return links;
}

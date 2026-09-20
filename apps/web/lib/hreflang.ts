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

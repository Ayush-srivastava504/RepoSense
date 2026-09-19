// Module: lib/site.ts
//
// SINGLE SOURCE OF TRUTH for the site's canonical origin.
//
// Canonical host = the apex domain (no "www"). Every canonical tag,
// og:url, JSON-LD url, sitemap <loc> and robots.txt Sitemap line must be
// built from this constant. `www.intern-flow.in` is only a 301 redirect
// to this host (configured in the Vercel domain settings) and must never
// be emitted by the app.
//
// NEXT_PUBLIC_SITE_URL can override this for a staging deployment. If it
// is set to a www host it is ignored, so a stale env var can't silently
// re-introduce the old host.
const DEFAULT_SITE_URL = 'https://intern-flow.in';

function resolveSiteUrl(): string {
    const raw = (process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
    if (!raw)
        return DEFAULT_SITE_URL;
    try {
        const { protocol, hostname } = new URL(raw);
        if (protocol !== 'https:' && protocol !== 'http:')
            return DEFAULT_SITE_URL;
        if (hostname.startsWith('www.'))
            return DEFAULT_SITE_URL;
        return raw;
    }
    catch {
        return DEFAULT_SITE_URL;
    }
}

export const BASE_URL = resolveSiteUrl();

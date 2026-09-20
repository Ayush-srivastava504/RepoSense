import { NextRequest, NextResponse } from 'next/server';
import { i18n, type Locale } from './i18n/config';
import { goneHtml, isJobGone, jobIdFromDetailPath } from './lib/goneJobs';

// Paths that must never be indexed even if something external links to
// them (private/account surfaces). robots.txt's Disallow only stops
// crawling; it does not stop an already-known URL from appearing in
// results with just a URL-only snippet if another site links to it. This
// header is the second layer FresherFlow's applySeoHeaders() uses:
// X-Robots-Tag acts even on pages robots.txt never let a bot fetch a
// sitemap for, because the header rides along on the actual page
// response instead of depending on the bot having read robots.txt first.
//
// PHASE 2 audit (see PHASE_PLAN.md item 7) — decided per-route for the
// rest of the (auth) route group:
//   - /login, /register: added here. Pure auth-flow pages — no unique
//     content, identical boilerplate on every visit, and not something
//     anyone should land on from search. They were previously listed in
//     sitemap-static.xml (removed as part of this change — a sitemap
//     entry for a noindexed URL is a conflicting signal to crawlers).
//   - /resume(/builder), /ats-checker, /cover-letter, /github, /linkedin:
//     left indexable. AuthGuard lets guests in via ensureGuestSession()
//     (no real login required to view or use them), and they were
//     deliberately added to sitemap-static.xml during the Aug SEO pass
//     as tool landing pages — noindexing them now would contradict that.
//   - /leetcode(/[slug]): left indexable. These are server components
//     with their own generateMetadata/canonical/JSON-LD, built
//     specifically to be crawled — clearest signal of the group.
const NOINDEX_PREFIXES = ['/dashboard', '/login', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals, and sitemaps
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/sitemap')
  ) {
    return NextResponse.next();
  }

  const shouldNoIndex = NOINDEX_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  // Check if pathname starts with a locale prefix like /es, /es/blog, /ja, /fr, etc.
  const pathSegments = pathname.split('/');
  const maybeLocale = pathSegments[1] as Locale;
  const isLocalePrefix = i18n.locales.includes(maybeLocale) && maybeLocale !== i18n.defaultLocale;

  // Expired jobs answer 410 Gone instead of 404 (Next.js 14 pages can't set a
  // 410 themselves). Runs on the locale-stripped path so /es/jobs/... is
  // covered too. Fails open: API errors just fall through to normal rendering.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const logicalPath = isLocalePrefix ? '/' + pathSegments.slice(2).join('/') : pathname;
    const jobId = jobIdFromDetailPath(logicalPath);
    if (jobId && (await isJobGone(jobId))) {
      return new NextResponse(goneHtml(), {
        status: 410,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-robots-tag': 'noindex, follow',
          // Short: the crawler re-activates a job if it reappears upstream.
          'cache-control': 'public, max-age=300',
        },
      });
    }
  }

  if (isLocalePrefix) {
    // Strip locale prefix for internal Next.js App Router rewrite
    // e.g. /es/blog -> /blog, /es -> /
    const remainingSegments = pathSegments.slice(2);
    const internalPath = '/' + remainingSegments.join('/');
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = internalPath === '' ? '/' : internalPath;

    // Set x-locale on the REQUEST headers (not just the response) so
    // Server Components -- app/layout.tsx, app/blog/page.tsx,
    // app/blog/[slug]/page.tsx -- can read the real locale via headers()
    // on every request, not only once the NEXT_LOCALE cookie set below has
    // round-tripped back on a later visit.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-locale', maybeLocale);
    const response = NextResponse.rewrite(rewriteUrl, { request: { headers: requestHeaders } });
    response.headers.set('x-locale', maybeLocale);
    response.cookies.set('NEXT_LOCALE', maybeLocale, {
      path: '/',
      maxAge: 31536000,
      sameSite: 'lax',
    });
    if (shouldNoIndex) {
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    }
    return response;
  }

  // Default English route
  const defaultRequestHeaders = new Headers(request.headers);
  defaultRequestHeaders.set('x-locale', i18n.defaultLocale);
  const response = NextResponse.next({ request: { headers: defaultRequestHeaders } });
  response.headers.set('x-locale', i18n.defaultLocale);
  if (shouldNoIndex) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|.*\\..*).*)'],
};

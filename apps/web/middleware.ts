import { NextRequest, NextResponse } from 'next/server';
import { i18n, type Locale } from './i18n/config';

// PHASE 1 — paths that must never be indexed even if something external
// links to them (private/account surfaces). robots.txt's Disallow only
// stops crawling; it does not stop an already-known URL from appearing in
// results with just a URL-only snippet if another site links to it. This
// header is the second layer FresherFlow's applySeoHeaders() uses:
// X-Robots-Tag acts even on pages robots.txt never let a bot fetch a
// sitemap for, because the header rides along on the actual page
// response instead of depending on the bot having read robots.txt first.
// Deliberately scoped to /dashboard only for Phase 1 — the (auth) route
// group also contains what may be public, indexable tool landing pages
// (resume/cover-letter/ats-checker) gated behind login for *use*, not for
// *viewing*; noindexing those needs a product decision, not a blanket
// rule, so it's left for Phase 2 (see PHASE_PLAN.md).
const NOINDEX_PREFIXES = ['/dashboard'];

export function middleware(request: NextRequest) {
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

  if (isLocalePrefix) {
    // Strip locale prefix for internal Next.js App Router rewrite
    // e.g. /es/blog -> /blog, /es -> /
    const remainingSegments = pathSegments.slice(2);
    const internalPath = '/' + remainingSegments.join('/');
    const rewriteUrl = request.nextUrl.clone();
    rewriteUrl.pathname = internalPath === '' ? '/' : internalPath;

    const response = NextResponse.rewrite(rewriteUrl);
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
  const response = NextResponse.next();
  response.headers.set('x-locale', i18n.defaultLocale);
  if (shouldNoIndex) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|.*\\..*).*)'],
};

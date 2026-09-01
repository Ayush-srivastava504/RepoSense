import { NextRequest, NextResponse } from 'next/server';
import { i18n, type Locale } from './i18n/config';

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
    return response;
  }

  // Default English route
  const response = NextResponse.next();
  response.headers.set('x-locale', i18n.defaultLocale);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|.*\\..*).*)'],
};

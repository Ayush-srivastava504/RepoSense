import { NextRequest, NextResponse } from 'next/server';
import { i18n } from './i18n/config';

function getLocale(request: NextRequest): string {
  // Check cookie first
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && i18n.locales.includes(cookieLocale as any)) {
    return cookieLocale;
  }

  // Check Accept-Language header
  const acceptLang = request.headers.get('accept-language');
  if (acceptLang) {
    const preferred = acceptLang
      .split(',')
      .map((lang) => {
        const [code, q] = lang.trim().split(';q=');
        return { code: code.split('-')[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q);

    for (const { code } of preferred) {
      if (i18n.locales.includes(code as any)) {
        return code;
      }
    }
  }

  return i18n.defaultLocale;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip API routes, static files, Next.js internals
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') ||
    pathname.startsWith('/sitemap')
  ) {
    return NextResponse.next();
  }

  // Check if pathname already has a locale prefix
  const pathnameHasLocale = i18n.locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
  );

  if (pathnameHasLocale) {
    return NextResponse.next();
  }

  // For default locale (en), don't redirect — serve as-is for backward compat
  const locale = getLocale(request);
  if (locale === i18n.defaultLocale) {
    // Set locale header for server components
    const response = NextResponse.next();
    response.headers.set('x-locale', locale);
    return response;
  }

  // For non-default locales, rewrite (not redirect) to keep clean URLs
  // But only if there's a cookie or strong preference
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && cookieLocale !== i18n.defaultLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Default: serve English content
  const response = NextResponse.next();
  response.headers.set('x-locale', i18n.defaultLocale);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|.*\\..*).*)'],
};

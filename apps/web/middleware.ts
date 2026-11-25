import { NextRequest, NextResponse } from 'next/server';
import { i18n, type Locale } from './i18n/config';
import { goneHtml, isJobGone, jobIdFromDetailPath } from './lib/goneJobs';

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

  // The site is English-only. The old locale prefixes (/es, /ja, /fr, /de, /pt, /ko, /it, /hi)
  // served the same English content under a translated shell and canonicalised to English, so
  // every one was a duplicate URL. They now 301 to the English page so Google drops them and
  // merges any signals into the real URL. The NEXT_LOCALE cookie is cleared so returning
  // visitors don't keep a translated UI chrome.
  const pathSegments = pathname.split('/');
  const maybeLocale = pathSegments[1] as Locale;
  if (i18n.locales.includes(maybeLocale) && maybeLocale !== i18n.defaultLocale) {
    const target = request.nextUrl.clone();
    target.pathname = '/' + pathSegments.slice(2).join('/');
    const redirect = NextResponse.redirect(target, 301);
    redirect.cookies.delete('NEXT_LOCALE');
    return redirect;
  }

  // Expired jobs answer 410 Gone instead of 404 (Next.js 14 pages can't set a
  // 410 themselves). Fails open: API errors just fall through to normal rendering.
  if (request.method === 'GET' || request.method === 'HEAD') {
    const jobId = jobIdFromDetailPath(pathname);
    if (jobId && (await isJobGone(jobId))) {
      return new NextResponse(goneHtml(), {
        status: 410,
        headers: {
          'content-type': 'text/html; charset=utf-8',
          // Short: the crawler re-activates a job if it reappears upstream.
          'cache-control': 'public, max-age=300',
        },
      });
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-locale', i18n.defaultLocale);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-locale', i18n.defaultLocale);
  if (request.cookies.has('NEXT_LOCALE')) {
    response.cookies.delete('NEXT_LOCALE');
  }
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon|.*\\..*).*)'],
};

// Module: app/sitemap-jobs.xml/route.ts
// Legacy URL, still submitted in Search Console. The job sitemap is now split
// by category under /sitemaps/ (see app/sitemaps/[file]/route.ts); a sitemap
// index may not contain another index, so this just forwards to the first file.

import { BASE_URL } from '@/lib/site';

export const dynamic = 'force-dynamic';

export function GET() {
    return Response.redirect(`${BASE_URL}/sitemaps/jobs-1.xml`, 301);
}

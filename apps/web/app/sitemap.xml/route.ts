// Module: app/sitemap.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    const sitemaps = [
        `${BASE_URL}/sitemap-static.xml`,
        `${BASE_URL}/sitemap-jobs.xml`,
        `${BASE_URL}/sitemap-hackathons.xml`,
        `${BASE_URL}/sitemap-tools.xml`,
        `${BASE_URL}/sitemap-blog.xml`,
    ];
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
        .map((loc) => `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`)
        .join('\n')}
</sitemapindex>`;
    return new Response(body, {
        headers: { 'Content-Type': 'application/xml' },
    });
}

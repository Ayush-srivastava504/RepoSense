// Module: app/sitemap-careers.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { CAREERS } from '@/app/careers/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/careers`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
        ...CAREERS.map((career) => ({
            loc: `${BASE_URL}/careers/${career.slug}`,
            lastmod: now,
            changefreq: 'daily' as const,
            priority: 0.7,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

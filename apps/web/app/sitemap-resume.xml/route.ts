// Module: app/sitemap-resume.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { RESUME_ROLES } from '@/app/resume-for/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/resume-for`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
        ...RESUME_ROLES.map((role) => ({
            loc: `${BASE_URL}/resume-for/${role.slug}`,
            lastmod: now,
            changefreq: 'weekly' as const,
            priority: 0.7,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

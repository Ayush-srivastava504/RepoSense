// Module: app/sitemap-skills.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { SKILLS } from '@/app/skills/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/skills`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
        ...SKILLS.map((skill) => ({
            loc: `${BASE_URL}/skills/${skill.slug}`,
            lastmod: now,
            changefreq: 'daily' as const,
            priority: 0.7,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

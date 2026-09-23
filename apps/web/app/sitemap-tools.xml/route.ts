// Module: app/sitemap-tools.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { TOOLS } from '@/app/tools/data';
import { COMPARISONS } from '@/app/tools/comparisons';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/tools`, changefreq: 'weekly', priority: 0.8 },
        ...TOOLS.map((tool) => ({
            loc: `${BASE_URL}/tools/${tool.slug}`,
            changefreq: 'weekly' as const,
            priority: 0.7,
        })),
        ...COMPARISONS.map((comparison) => ({
            loc: `${BASE_URL}/tools/${comparison.toolSlug}/vs/${comparison.competitorSlug}`,
            changefreq: 'weekly' as const,
            priority: 0.6,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

// Module: app/sitemap-companies.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getCompanies, companySlug } from '@/lib/companies';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    // 200 is the API's hard cap (limit_per_section, le=200); requesting more 422s.
    const { top, mass_hire, startup } = await getCompanies(200);
    const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/companies`, lastmod: now, changefreq: 'daily', priority: 0.8 },
        ...all
            .filter((c) => c.company)
            .map((c) => ({
            loc: `${BASE_URL}/companies/${companySlug(c.company)}`,
            lastmod: c.last_posted_at ? new Date(c.last_posted_at).toISOString() : now,
            changefreq: 'daily' as const,
            priority: 0.6,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

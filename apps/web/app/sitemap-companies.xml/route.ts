// Module: app/sitemap-companies.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getCompanies, companySlug } from '@/lib/companies';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    let all: Awaited<ReturnType<typeof getCompanies>>['top']['companies'] = [];
    try {
        // 200 is the API's hard cap (limit_per_section, le=200); requesting more 422s.
        const { top, mass_hire, startup } = await getCompanies(200);
        all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    }
    catch (err) {
        // Without this, a single failed upstream call throws out of the route
        // handler and Next.js serves its HTML error page in place of the sitemap,
        // which Search Console flags as invalid XML.
        console.error('Failed to build companies sitemap:', err);
    }
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/companies`, changefreq: 'daily', priority: 0.8 },
        ...all
            .filter((c) => c.company)
            .map((c) => ({
            loc: `${BASE_URL}/companies/${companySlug(c.company)}`,
            lastmod: c.last_posted_at ? new Date(c.last_posted_at).toISOString() : undefined,
            changefreq: 'daily' as const,
            priority: 0.6,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

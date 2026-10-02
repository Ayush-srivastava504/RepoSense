// Module: app/sitemap-companies.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getCompaniesOrThrow, companySlug } from '@/lib/companies';
import { sitemapOk, sitemapUnavailable } from '@/lib/sitemapResponse';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    let all: Awaited<ReturnType<typeof getCompaniesOrThrow>>['top']['companies'] = [];
    try {
        // 200 is the API's hard cap (limit_per_section, le=200); requesting more 422s.
        const { top, mass_hire, startup } = await getCompaniesOrThrow(200);
        all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    }
    catch (err) {
        // A failed upstream call must not become a sitemap holding only /companies (search engines read
        // that as "every company page was removed"); 503 + Retry-After makes them keep what they have.
        return sitemapUnavailable('companies', err);
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
    return sitemapOk(xml);
}

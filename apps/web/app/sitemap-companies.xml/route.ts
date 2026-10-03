// Module: app/sitemap-companies.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getCompaniesOrThrow, getIntelSitemapEntries, getCompanyDirectory, companySlug } from '@/lib/companies';
import { sitemapOk, sitemapUnavailable } from '@/lib/sitemapResponse';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { COMPANY_MIN_JOBS } from '@/lib/seo/hubThresholds';
export const dynamic = 'force-dynamic';
export async function GET() {
    let all: Awaited<ReturnType<typeof getCompaniesOrThrow>>['top']['companies'] = [];
    let letters: { letter: string }[] = [];
    let intelOnly: Awaited<ReturnType<typeof getIntelSitemapEntries>> = [];
    try {
        // 200 is the API's hard cap (limit_per_section, le=200); requesting more 422s.
        const { top, mass_hire, startup } = await getCompaniesOrThrow(200);
        all = [...top.companies, ...mass_hire.companies, ...startup.companies];
        // Only slugs actually emitted below count as known; otherwise a company with 1 job and 5+ topics
        // (indexable on content) is dropped from both lists.
        const known = new Set(all.filter((c) => c.company && c.job_count >= COMPANY_MIN_JOBS).map((c) => companySlug(c.company)));
        // Companies with enough published topics are indexable even with no live jobs / past the 200 cap.
        intelOnly = (await getIntelSitemapEntries()).filter((e) => !known.has(e.slug));
        letters = (await getCompanyDirectory())?.letters ?? [];
    }
    catch (err) {
        // A failed upstream call must not become a sitemap holding only /companies (search engines read
        // that as "every company page was removed"); 503 + Retry-After makes them keep what they have.
        return sitemapUnavailable('companies', err);
    }
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/companies`, changefreq: 'daily', priority: 0.8 },
        ...letters.map((l) => ({ loc: `${BASE_URL}/company-directory/${l.letter}`, changefreq: 'daily' as const, priority: 0.5 })),
        ...all
            .filter((c) => c.company && c.job_count >= COMPANY_MIN_JOBS)
            .map((c) => ({
            loc: `${BASE_URL}/companies/${companySlug(c.company)}`,
            lastmod: c.last_posted_at ? new Date(c.last_posted_at).toISOString() : undefined,
            changefreq: 'daily' as const,
            priority: 0.6,
        })),
        ...intelOnly.map((e) => ({
            loc: `${BASE_URL}/companies/${e.slug}`,
            lastmod: e.updated_at ? new Date(e.updated_at).toISOString() : undefined,
            changefreq: 'weekly' as const,
            priority: 0.5,
        })),
    ]);
    return sitemapOk(xml, 'companies');
}

// Same fallback chain as lib/hackathons.ts — some environments (local, preview deploys) only
// ever set NEXT_PUBLIC_API_BASE_URL, not the server-only API_BASE_URL. Requiring
// API_BASE_URL specifically here silently emptied out the whole /companies page in those
// environments even though every other data source kept working.

const API_BASE_URL = process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';
export type CompanyTier = 'top' | 'mass_hire' | 'startup';
export interface Company {
    company: string;
    job_count: number;
    is_official_domain?: boolean;
    apply_domain?: string;
    logo_domain?: string;
    sample_location?: string;
    last_posted_at?: string;
    tier: CompanyTier;
}
interface CompanySection {
    companies: Company[];
    total: number;
}
export interface CompaniesResponse {
    top: CompanySection;
    mass_hire: CompanySection;
    startup: CompanySection;
    mass_hire_threshold: number;
}
const EMPTY_SECTION: CompanySection = { companies: [], total: 0 };
const EMPTY_RESPONSE: CompaniesResponse = {
    top: EMPTY_SECTION,
    mass_hire: EMPTY_SECTION,
    startup: EMPTY_SECTION,
    mass_hire_threshold: 0,
};
export function companySlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
    // 200 is the API's hard cap (limit_per_section, le=200) — asking for more 422s and
    // getCompanies() swallows that into an empty response, so this would silently 404
    // every company page.
    const { top, mass_hire, startup } = await getCompanies(200);
    const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    return all.find((c) => companySlug(c.company) === slug) ?? null;
}
export async function getCompanies(limitPerSection = 60): Promise<CompaniesResponse> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/companies/?limit_per_section=${limitPerSection}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.error('Companies API returned', res.status);
            return EMPTY_RESPONSE;
        }
        return (await res.json()) as CompaniesResponse;
    }
    catch (err) {
        console.error('Failed to fetch companies:', err);
        return EMPTY_RESPONSE;
    }
}

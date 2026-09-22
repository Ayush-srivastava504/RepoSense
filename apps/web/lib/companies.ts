// Same fallback chain as lib/hackathons.ts — some environments (local, preview deploys) only
// ever set NEXT_PUBLIC_API_BASE_URL, not the server-only API_BASE_URL. Requiring
// API_BASE_URL specifically here silently emptied out the whole /companies page in those
// environments even though every other data source kept working.

import { fetchWithTimeout } from './fetchWithTimeout';

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
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/?limit_per_section=${limitPerSection}`, { next: { revalidate: 3600 } });
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

// Matches company_facts_service.py's build_facts() shape exactly — every field
// is an aggregate over the company's own currently-listed jobs, or absent.
export interface CompanyProfileFacts {
    as_of: string;
    active_listings: number;
    internships: number;
    jobs: number;
    locations: { name: string; count: number }[];
    work_modes: Record<string, number>;
    remote_listings: number;
    job_functions: { name: string; count: number }[];
    skills: { name: string; count: number }[];
    courses: { name: string; count: number }[];
    experience: { min: number | null; max: number | null; fresher_listings: number } | null;
    pay: { stipend_listings: number; salary_listings: number };
    official_domain: string | null;
    first_listed: string | null;
    latest_posted: string | null;
}
export interface CompanyProfile {
    company: string;
    overview: string;
    keywords: string[] | null;
    facts: CompanyProfileFacts;
    model: string;
    enriched_at: string;
}
// GET /api/companies/{company}/profile 404s when the company has too few
// facts for a profile (company_facts_service.py's MIN_SUBSTANTIVE_SECTIONS) —
// that's an expected, common case, not an error, so it resolves to null
// rather than throwing. Any other failure (network, 5xx) also degrades to
// null: the company page renders fine without a profile panel either way.
export async function getCompanyProfile(company: string): Promise<CompanyProfile | null> {
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/${encodeURIComponent(company)}/profile`, { next: { revalidate: 3600 } });
        if (!res.ok)
            return null;
        return (await res.json()) as CompanyProfile;
    }
    catch (err) {
        console.error('Failed to fetch company profile:', err);
        return null;
    }
}

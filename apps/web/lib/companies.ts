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
export interface CompanyTopic {
    topic_key: string;
    title: string;
    body: string;
    bullets: string[];
    source_urls: string[];
    enriched_at: string;
}
export interface CompanyIntel {
    slug: string;
    name: string;
    official_domain: string | null;
    logo_domain: string | null;
    last_crawled_at: string | null;
    job_count: number;
    last_posted_at: string | null;
    topics: CompanyTopic[];
}
// GET /api/companies/by-slug/{slug}: crawled-and-enriched topics for one company. 404 (no entity yet)
// and any failure resolve to null -- the page then renders from the jobs data alone.
export async function getCompanyIntel(slug: string): Promise<CompanyIntel | null> {
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/by-slug/${encodeURIComponent(slug)}`, { next: { revalidate: 3600 } });
        if (!res.ok)
            return null;
        return (await res.json()) as CompanyIntel;
    }
    catch (err) {
        console.error('Failed to fetch company intel:', err);
        return null;
    }
}
// Companies with enough published topics to be indexable even with no live jobs.
export async function getIntelSitemapEntries(): Promise<{ slug: string; name: string; updated_at: string | null }[]> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/intel/sitemap`, { next: { revalidate: 3600 } });
    if (res.status === 404)
        return []; // API not deployed with the intel endpoint yet: no intel-only companies, not a failure
    if (!res.ok)
        throw new Error(`Company intel sitemap API returned ${res.status}`);
    return ((await res.json()) as { companies: { slug: string; name: string; updated_at: string | null }[] }).companies;
}
export async function getCompanyBySlug(slug: string): Promise<Company | null> {
    // 200 is the API's hard cap (limit_per_section, le=200) -- asking for more 422s and
    // getCompanies() swallows that into an empty response. Companies past that cap (or with
    // no live jobs) are resolved through their entity instead of 404ing.
    const { top, mass_hire, startup } = await getCompanies(200);
    const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    const found = all.find((c) => companySlug(c.company) === slug);
    if (found)
        return found;
    const intel = await getCompanyIntel(slug);
    if (!intel)
        return null;
    return {
        company: intel.name,
        job_count: intel.job_count,
        is_official_domain: Boolean(intel.official_domain),
        apply_domain: intel.official_domain ?? undefined,
        logo_domain: intel.logo_domain ?? undefined,
        last_posted_at: intel.last_posted_at ?? undefined,
        tier: 'startup',
    };
}
// Throws on failure (see getJobsOrThrow) -- for sitemap routes that must not publish a silently shrunk list.
export async function getCompaniesOrThrow(limitPerSection = 60): Promise<CompaniesResponse> {
    const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/?limit_per_section=${limitPerSection}`, { next: { revalidate: 3600 } });
    if (!res.ok) {
        throw new Error(`Companies API returned ${res.status}`);
    }
    return (await res.json()) as CompaniesResponse;
}
export async function getCompanies(limitPerSection = 60): Promise<CompaniesResponse> {
    try {
        return await getCompaniesOrThrow(limitPerSection);
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

// A-Z company directory: gives every company (including those past the hub's per-tier cap) a crawlable link path.
export interface DirectoryLetter {
    letter: string;
    count: number;
}
export interface CompanyDirectoryPage {
    letters: DirectoryLetter[];
    letter: string | null;
    total: number;
    companies: Company[];
}
export const DIRECTORY_PAGE_SIZE = 100;
export async function getCompanyDirectory(letter?: string, page = 1): Promise<CompanyDirectoryPage | null> {
    const qs = new URLSearchParams();
    if (letter) {
        qs.set('letter', letter);
        qs.set('limit', String(DIRECTORY_PAGE_SIZE));
        qs.set('offset', String((Math.max(1, page) - 1) * DIRECTORY_PAGE_SIZE));
    }
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/companies/directory?${qs.toString()}`, { next: { revalidate: 3600 } });
        return res.ok ? (await res.json()) as CompanyDirectoryPage : null;
    }
    catch (err) {
        console.error('Failed to fetch company directory:', err);
        return null;
    }
}
export function directoryLabel(letter: string): string {
    return letter === '0-9' ? '0-9' : letter === 'other' ? 'Other' : letter.toUpperCase();
}

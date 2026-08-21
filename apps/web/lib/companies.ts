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

/**
 * Companies aggregated from active listings in the jobs table (see
 * services/api/src/routes/companies.py), grouped server-side into three
 * tiers:
 *  - top: the same curated TOP_COMPANY_TIER list that drives the "Top
 *    Company" badge on job cards.
 *  - mass_hire: not in the top tier, but currently running a lot of
 *    active listings at once (hiring at scale right now).
 *  - startup: everyone else with at least one active listing.
 */
export async function getCompanies(
  limitPerSection = 60
): Promise<CompaniesResponse> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return EMPTY_RESPONSE;
  }

  try {
    const res = await fetch(
      `${process.env.API_BASE_URL}/api/companies/?limit_per_section=${limitPerSection}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error('Companies API returned', res.status);
      return EMPTY_RESPONSE;
    }

    return (await res.json()) as CompaniesResponse;
  } catch (err) {
    console.error('Failed to fetch companies:', err);
    return EMPTY_RESPONSE;
  }
}

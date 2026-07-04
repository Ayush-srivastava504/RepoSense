export const BASE_URL = 'https://intern-flow.in';

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  posted_at: string;
  location?: string;
  type?: string;
  salary?: string;
  stipend?: string;
  deadline?: string;
  confidence_score?: number;
  confidence_label?: 'verified' | 'high_confidence' | 'review_recommended' | 'unverified';
  apply_domain?: string;
  is_official_domain?: boolean;
  is_new?: boolean;
  is_top_company?: boolean;
  is_verified_source?: boolean;
  is_hot?: boolean;
}

interface JobsResponse {
  jobs?: Job[];
  data?: Job[];
  results?: Job[];
}

function coerceJobs(data: JobsResponse | Job[]): Job[] {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.jobs)) return data.jobs;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.results)) return data.results;
  return [];
}

/**
 * Fetch the job feed.
 *
 * `sort: 'ranked'` is what powers the first-page ordering (top_company_boost
 * + freshness_boost + confidence_boost, applied server-side in
 * /api/jobs). It doesn't remove or hide anything — it's the same rows, just
 * reordered — so pagination (limit/offset) keeps working exactly as before.
 */
export async function getJobs(options: {
  search?: string;
  type?: string;
  sort?: 'recent' | 'ranked';
  limit?: number;
} = {}): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 500),
      sort: options.sort ?? 'recent',
    });

    if (options.search) params.set('search', options.search);
    if (options.type) params.set('type', options.type);

    const res = await fetch(
      `${process.env.API_BASE_URL}/api/jobs/?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error('Jobs API returned', res.status);
      return [];
    }

    return coerceJobs(await res.json());
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    return [];
  }
}

/**
 * Featured opportunities: a small, honestly-curated set (real DB rows only —
 * never fabricated) surfaced above the main feed. Returns [] when nothing
 * currently qualifies, in which case the caller should just hide the
 * section rather than show placeholders.
 */
export async function getFeaturedJobs(options: {
  type?: string;
  limit?: number;
} = {}): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({
      limit: String(options.limit ?? 6),
    });

    if (options.type) params.set('type', options.type);

    const res = await fetch(
      `${process.env.API_BASE_URL}/api/jobs/featured?${params.toString()}`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error('Featured jobs API returned', res.status);
      return [];
    }

    return coerceJobs(await res.json());
  } catch (err) {
    console.error('Failed to fetch featured jobs:', err);
    return [];
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return null;
  }

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error('Job detail API returned', res.status, 'for id', id);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error('Failed to fetch job:', err);
    return null;
  }
}

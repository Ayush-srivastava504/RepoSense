// Module: lib/jobs.ts
// Defines component(s)/export(s): BASE_URL
// Defines function(s): coerceJobs, getJobs, getFeaturedJobs, getSimilarJobs, getJobById
// Defines type(s): JobGroup, Job, JobsResponse

export const BASE_URL = 'https://www.intern-flow.in';
export type JobGroup = 'software' | 'sales' | 'finance' | 'other';
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
    logo_domain?: string;
    is_official_domain?: boolean;
    is_new?: boolean;
    is_top_company?: boolean;
    is_verified_source?: boolean;
    is_hot?: boolean;
    is_stale?: boolean;
    is_remote?: boolean;
    is_government?: boolean;
    country?: string;
    department?: string;
    vacancies?: string;
    notification_number?: string;
    job_group?: JobGroup;
    last_seen_at?: string;
    enriched_overview?: string;
    enriched_keywords?: string[];
}
interface JobsResponse {
    jobs?: Job[];
    data?: Job[];
    results?: Job[];
}
function coerceJobs(data: JobsResponse | Job[]): Job[] {
    if (Array.isArray(data))
        return data;
    if (Array.isArray(data.jobs))
        return data.jobs;
    if (Array.isArray(data.data))
        return data.data;
    if (Array.isArray(data.results))
        return data.results;
    return [];
}
export async function getJobs(options: {
    search?: string;
    type?: string;
    category?: 'remote' | 'government';
    job_group?: JobGroup;
    country?: string;
    company?: string;
    skill?: string;
    sort?: 'recent' | 'ranked';
    limit?: number;
    offset?: number;
} = {}): Promise<Job[]> {
    if (!process.env.API_BASE_URL) {
        console.error('API_BASE_URL is not set');
        return [];
    }
    try {
        const params = new URLSearchParams({
            limit: String(options.limit ?? 500),
            offset: String(options.offset ?? 0),
            sort: options.sort ?? 'recent',
        });
        if (options.search)
            params.set('search', options.search);
        if (options.type)
            params.set('type', options.type);
        if (options.category)
            params.set('category', options.category);
        if (options.job_group)
            params.set('job_group', options.job_group);
        if (options.country)
            params.set('country', options.country);
        if (options.company)
            params.set('company', options.company);
        if (options.skill)
            params.set('skill', options.skill);
        const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/?${params.toString()}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.error('Jobs API returned', res.status);
            return [];
        }
        return coerceJobs(await res.json());
    }
    catch (err) {
        console.error('Failed to fetch jobs:', err);
        return [];
    }
}
export async function getFeaturedJobs(options: {
    type?: string;
    category?: 'remote' | 'government';
    job_group?: JobGroup;
    country?: string;
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
        if (options.type)
            params.set('type', options.type);
        if (options.category)
            params.set('category', options.category);
        if (options.job_group)
            params.set('job_group', options.job_group);
        if (options.country)
            params.set('country', options.country);
        const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/featured?${params.toString()}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.error('Featured jobs API returned', res.status);
            return [];
        }
        return coerceJobs(await res.json());
    }
    catch (err) {
        console.error('Failed to fetch featured jobs:', err);
        return [];
    }
}
export async function getSimilarJobs(jobId: string, limit = 6): Promise<Job[]> {
    if (!process.env.API_BASE_URL) {
        console.error('API_BASE_URL is not set');
        return [];
    }
    try {
        const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/${jobId}/similar?limit=${limit}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.error('Similar jobs API returned', res.status);
            return [];
        }
        return coerceJobs(await res.json());
    }
    catch (err) {
        console.error('Failed to fetch similar jobs:', err);
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
    }
    catch (err) {
        console.error('Failed to fetch job:', err);
        return null;
    }
}

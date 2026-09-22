// Module: lib/jobs.ts
// Defines component(s)/export(s): BASE_URL
// Defines function(s): coerceJobs, getJobs, getFeaturedJobs, getSimilarJobs, getJobById
// Defines type(s): JobGroup, Job, JobsResponse

import { fetchWithTimeout } from './fetchWithTimeout';
import { BASE_URL } from './site';

// Canonical origin lives in lib/site.ts (non-www). Re-exported here so existing
// `import { BASE_URL } from '@/lib/jobs'` call sites keep working.
export { BASE_URL };
// Same fallback chain as lib/companies.ts — some environments (build-time
// static generation in particular, e.g. /companies/[company]'s
// generateStaticParams) only ever have NEXT_PUBLIC_API_BASE_URL populated,
// not the server-only API_BASE_URL. Requiring API_BASE_URL specifically
// here was silently emptying out every statically-generated page's job
// list (while metadata built from lib/companies.ts, which already had this
// fallback, stayed correct) — the "37 active listings, 0 shown" bug on
// /companies/[company] hub pages.
const API_BASE_URL = process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';
export type JobGroup = 'software' | 'sales' | 'finance' | 'other';
export interface Job {
    id: string;
    title: string;
    company: string;
    description: string;
    url: string;
    source: string;
    posted_at: string;
    // Added so datePosted / lastmod can fall back to a real creation
    // timestamp instead of last_seen_at (which moves on every crawl).
    // Present once services/api/src/routes/jobs.py's JOB_COLUMNS includes
    // it and migrations/016_fix_jobs_created_at.sql has run in production.
    created_at?: string;
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
    // Structured breakdown — see migrations/021_structured_job_details.sql
    // and crawler/src/structured_enrichment.py. All optional/nullable:
    // NULL until the next enrichment pass has run for a given job.
    allowed_degrees?: string[];
    allowed_courses?: string[];
    allowed_specializations?: string[];
    allowed_passout_years?: number[];
    required_skills?: string[];
    notes_highlights?: string;
    work_mode?: string;
    experience_min?: number;
    experience_max?: number;
    job_function?: string;
    structured_description?: string;
    // Quality gate — see migrations/020_job_quality_gate.sql and
    // crawler/src/processors/quality.py. is_thin is a heuristic on
    // description length at scrape time; enriched_overview (above) is the
    // stronger, later signal that a job has since gotten a real AI
    // overview. Sitemap priority and indexability both key off "thin AND
    // still unenriched" rather than is_thin alone, since a thin job clears
    // automatically once enrichment fills it in.
    is_thin?: boolean;
    quality_score?: number;
    // Locale-aware content — migrations/024_job_translations.sql,
    // IMPLEMENTATION_PLAN.md §7. Always present (possibly []); lists every
    // locale this job actually has translated content for, regardless of
    // which locale (if any) was requested. Used to build job-aware
    // hreflang (lib/hreflang.ts's jobHreflangLinks()) without a second
    // API call, and so a locale with no row correctly falls back to
    // English instead of advertising a URL that's really just English
    // content again.
    translated_locales?: string[];
    // Set only when `?locale=` was passed AND that locale has a row —
    // title/enriched_overview/structured_description above are already
    // the translated versions in that case. Absent (not "en") means the
    // response is the original English content.
    content_locale?: string;
}
interface JobsResponse {
    jobs?: Job[];
    data?: Job[];
    results?: Job[];
    total?: number;
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
interface GetJobsOptions {
    search?: string;
    type?: string;
    category?: 'remote' | 'government';
    job_group?: JobGroup;
    country?: string;
    company?: string;
    skill?: string;
    work_mode?: 'ONSITE' | 'REMOTE' | 'HYBRID';
    course?: string;
    sort?: 'recent' | 'ranked';
    limit?: number;
    offset?: number;
    // Phase 2 (PHASE_PLAN.md item 2): multi-select facet filters, applied
    // server-side. Each is a list of facet-option slugs (FacetOption.value
    // from getJobFacets()); a job matches if it has ANY of the listed
    // values, ANDed across the five filter groups. Joined into the
    // comma-separated `skills=`/`courses=`/etc params routes/jobs.py's
    // `_parse_multi()` expects.
    skills?: string[];
    courses?: string[];
    sources?: string[];
    batches?: string[];
    companies?: string[];
    // Phase 2 pagination follow-up (PHASE_PLAN.md item 2's leftover note):
    // server-side equivalents of lib/jobPriority.ts's isIndiaJob()/
    // sortIndiaFirst(), so /jobs and /internships can paginate the
    // "India" location filter with real LIMIT/OFFSET — see getJobsPage().
    indiaOnly?: boolean;
    indiaFirst?: boolean;
}
function buildJobsParams(options: GetJobsOptions): URLSearchParams {
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
    if (options.work_mode)
        params.set('work_mode', options.work_mode);
    if (options.course)
        params.set('course', options.course);
    if (options.skills?.length)
        params.set('skills', options.skills.join(','));
    if (options.courses?.length)
        params.set('courses', options.courses.join(','));
    if (options.sources?.length)
        params.set('sources', options.sources.join(','));
    if (options.batches?.length)
        params.set('batches', options.batches.join(','));
    if (options.companies?.length)
        params.set('companies', options.companies.join(','));
    if (options.indiaOnly)
        params.set('india_only', 'true');
    if (options.indiaFirst)
        params.set('india_first', 'true');
    return params;
}
export async function getJobs(options: GetJobsOptions = {}): Promise<Job[]> {
    try {
        const params = buildJobsParams(options);
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/jobs/?${params.toString()}`, { next: { revalidate: 3600 } });
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
// Phase 2 pagination follow-up (PHASE_PLAN.md item 2's leftover note):
// same request as getJobs(), but also returns the backend's real `total`
// (a COUNT(*) over the full filtered table, not just the fetched page) so
// callers can paginate with actual LIMIT/OFFSET instead of over-fetching
// up to 500 rows and slicing client-side. Kept as a separate function
// rather than changing getJobs()'s return type, since getJobs() is called
// from many hub/sitemap pages that only ever want the array.
export async function getJobsPage(options: GetJobsOptions = {}): Promise<{ jobs: Job[]; total: number }> {
    try {
        const params = buildJobsParams(options);
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/jobs/?${params.toString()}`, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.error('Jobs API returned', res.status);
            return { jobs: [], total: 0 };
        }
        const data: JobsResponse = await res.json();
        const jobs = coerceJobs(data);
        // Fall back to the fetched page length only if the backend response
        // doesn't include `total` (e.g. an older/mocked API) — keeps this
        // degrading gracefully instead of breaking pagination outright.
        const total = typeof data.total === 'number' ? data.total : jobs.length;
        return { jobs, total };
    }
    catch (err) {
        console.error('Failed to fetch jobs:', err);
        return { jobs: [], total: 0 };
    }
}
export async function getFeaturedJobs(options: {
    type?: string;
    category?: 'remote' | 'government';
    job_group?: JobGroup;
    country?: string;
    limit?: number;
} = {}): Promise<Job[]> {
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
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/jobs/featured?${params.toString()}`, { next: { revalidate: 3600 } });
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
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/jobs/${jobId}/similar?limit=${limit}`, { next: { revalidate: 3600 } });
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
export class JobApiUnavailableError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'JobApiUnavailableError';
    }
}
/**
 * Only a genuine 404 means "no such job" (-> null -> the page's notFound()).
 * Rate limits (429), 5xx and network/timeout errors THROW instead: returning null
 * there made a healthy job page answer 404 to Googlebot whenever the API was busy,
 * and Google drops URLs it sees 404. A thrown error renders as a 5xx, which
 * crawlers treat as temporary and retry, and ISR keeps serving the last good page.
 */
export async function getJobById(id: string, locale?: string): Promise<Job | null> {
    let res: Response;
    const url = locale
        ? `${API_BASE_URL}/api/jobs/${id}?locale=${encodeURIComponent(locale)}`
        : `${API_BASE_URL}/api/jobs/${id}`;
    try {
        res = await fetchWithTimeout(url, {
            next: { revalidate: 3600 },
        });
    }
    catch (err) {
        console.error('Failed to fetch job:', err);
        throw new JobApiUnavailableError(`Job API unreachable for id ${id}`);
    }
    if (res.status === 404) {
        return null;
    }
    if (!res.ok) {
        console.error('Job detail API returned', res.status, 'for id', id);
        throw new JobApiUnavailableError(`Job API returned ${res.status} for id ${id}`);
    }
    return res.json();
}

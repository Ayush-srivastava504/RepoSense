// Module: lib/slug.ts
// Defines function(s): slugify, jobSlug, jobIdFromSlug, canonicalCategoryForJob, canonicalPathForJob
//
//

function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}
export function jobSlug(job: {
    id: string;
    title: string;
    company: string;
    location?: string;
    salary?: string;
    stipend?: string;
}): string {
    const parts = [slugify(job.title), slugify(job.company)];
    const city = job.location?.split(',')[0]?.trim();
    if (city) {
        parts.push(slugify(city));
    }
    const pay = job.salary || job.stipend;
    if (pay) {
        parts.push(slugify(pay));
    }
    const base = parts.filter(Boolean).join('-');
    const MAX_BASE_LENGTH = 90;
    const truncatedBase = base.length > MAX_BASE_LENGTH
        ? base.slice(0, MAX_BASE_LENGTH).replace(/-+$/, '')
        : base;
    return `${truncatedBase}-${job.id}`;
}
export function jobIdFromSlug(slug: string): string {
    return slug.split('-').pop() ?? '';
}
export function canonicalCategoryForJob(job: {
    type?: string;
    is_remote?: boolean;
    is_government?: boolean;
}): 'government-jobs' | 'internships' | 'remote-jobs' | 'jobs' {
    if (job.is_government)
        return 'government-jobs';
    if (job.type === 'internship')
        return 'internships';
    if (job.is_remote)
        return 'remote-jobs';
    return 'jobs';
}
export function canonicalPathForJob(job: {
    id: string;
    title: string;
    company: string;
    location?: string;
    salary?: string;
    stipend?: string;
    type?: string;
    is_remote?: boolean;
    is_government?: boolean;
}): string {
    return `/${canonicalCategoryForJob(job)}/${jobSlug(job)}`;
}

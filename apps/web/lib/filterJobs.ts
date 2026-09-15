// Module: lib/filterJobs.ts
// Defines function(s): parseMultiParam, encodeMultiParam, parseAdvancedFilters,
//   hasActiveAdvancedFilters, applyAdvancedFilters
// Defines type(s): AdvancedFilters
//
// parseAdvancedFilters()/encodeMultiParam() read and write the
// ?skills=/&course=/&source=/&batch=/&company= query params the
// AdvancedJobFilters.tsx dropdown bar uses — these are still the source
// of truth for URL state regardless of where filtering happens.
//
// PHASE 1 also applied the resulting filters client-side, in-process,
// over an already-fetched Job[] array (see applyAdvancedFilters() below).
// PHASE 2 (PHASE_PLAN.md item 2) pushed that filtering server-side
// instead — jobs/page.tsx / internships/page.tsx now pass
// advancedFilters straight into getJobs()'s skills/courses/sources/
// batches/companies params, which routes/jobs.py applies in SQL. This
// scales past whatever `limit` getJobs() fetches, unlike the Phase 1
// array filter. applyAdvancedFilters() is kept here as a pure fallback/
// testing utility — it's no longer called from either list page.

import type { Job } from './jobs';
import { slugifyFacet } from './facets';

export interface AdvancedFilters {
    skills: string[];
    courses: string[];
    sources: string[];
    batches: string[];
    companies: string[];
}

// Query params are comma-separated slugs, e.g. ?skills=react,python&batch=2026,2027
export function parseMultiParam(value: string | undefined): string[] {
    if (!value) return [];
    return Array.from(
        new Set(
            value
                .split(',')
                .map((v) => v.trim())
                .filter(Boolean),
        ),
    );
}

export function encodeMultiParam(values: string[]): string | undefined {
    if (!values.length) return undefined;
    return values.join(',');
}

export function parseAdvancedFilters(searchParams: {
    skills?: string;
    course?: string;
    source?: string;
    batch?: string;
    company?: string;
}): AdvancedFilters {
    return {
        skills: parseMultiParam(searchParams.skills),
        courses: parseMultiParam(searchParams.course),
        sources: parseMultiParam(searchParams.source),
        batches: parseMultiParam(searchParams.batch),
        companies: parseMultiParam(searchParams.company),
    };
}

export function hasActiveAdvancedFilters(filters: AdvancedFilters): boolean {
    return (
        filters.skills.length > 0 ||
        filters.courses.length > 0 ||
        filters.sources.length > 0 ||
        filters.batches.length > 0 ||
        filters.companies.length > 0
    );
}

function matchesAny(jobValues: string[] | string | null | undefined, selected: string[]): boolean {
    if (selected.length === 0) return true;
    const values = Array.isArray(jobValues) ? jobValues : jobValues ? [jobValues] : [];
    const slugged = values.map(slugifyFacet);
    return selected.some((s) => slugged.includes(s));
}

export function applyAdvancedFilters(jobs: Job[], filters: AdvancedFilters): Job[] {
    if (!hasActiveAdvancedFilters(filters)) return jobs;
    return jobs.filter((job) => {
        if (!matchesAny(job.required_skills ?? job.enriched_keywords, filters.skills)) return false;
        if (!matchesAny(job.allowed_courses, filters.courses)) return false;
        if (!matchesAny(job.source, filters.sources)) return false;
        if (
            filters.batches.length > 0 &&
            !(job.allowed_passout_years ?? []).some((y) => filters.batches.includes(String(y)))
        )
            return false;
        if (!matchesAny(job.company, filters.companies)) return false;
        return true;
    });
}

// Module: lib/facets.ts
// Defines function(s): slugifyFacet, buildFacetCounts, getFacetSnapshot
// Defines type(s): FacetOption, FacetSnapshot
//
// PHASE 1 — computes the option lists (with live counts) that back the
// dropdown-popover filters in AdvancedJobFilters.tsx: Skills, Course,
// Source, Batch (passout year), and Company. This mirrors what
// FresherFlow's sitemap/facet generation does server-side in
// staticFeed.service.ts, except computed here in the Next.js layer over
// the already-fetched job array (getJobs() pulls up to `limit` jobs per
// request) rather than a dedicated backend facets endpoint.
//
// This is a deliberate Phase 1 scope call: it is correct and fast for the
// current catalog size, but does not scale past the `limit` passed to
// getJobs(). Phase 2 should add a real `/api/jobs/facets` endpoint that
// computes these counts against the full table server-side (see
// PHASE_PLAN.md) — swap the call site in jobs/page.tsx /
// internships/page.tsx for that endpoint's response and this file's
// public shape (`FacetSnapshot`) can stay the same.

import type { Job } from './jobs';

export interface FacetOption {
    value: string;
    label: string;
    count: number;
}

export interface FacetSnapshot {
    skills: FacetOption[];
    courses: FacetOption[];
    sources: FacetOption[];
    batches: FacetOption[];
    companies: FacetOption[];
}

// Matches lib/companies.ts's companySlug() / lib/skills's slug convention —
// duplicated here (rather than imported) because this needs to slugify
// arbitrary free-text facet values (skills, sources, courses) that don't
// have their own hub-page slug helper.
export function slugifyFacet(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Minimum listings required for a facet value to surface as a filter
// option at all — same "don't index/offer thin buckets" principle
// FresherFlow applies to its skills/roles/locations sitemaps
// (SKILL_MIN_JOBS = 5, LOCATION_MIN_JOBS = 3 in staticFeed.service.ts).
// Kept low here since this runs over a single page's worth of jobs
// (already filtered by location/role) rather than the whole catalog.
const MIN_COUNT = 1;
const MAX_OPTIONS_PER_FACET = 60;

function countBy(
    jobs: Job[],
    extract: (job: Job) => string[] | string | null | undefined,
): Map<string, { label: string; count: number }> {
    const counts = new Map<string, { label: string; count: number }>();
    for (const job of jobs) {
        const raw = extract(job);
        const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
        const seenOnThisJob = new Set<string>();
        for (const value of values) {
            const label = value?.trim();
            if (!label) continue;
            const key = slugifyFacet(label);
            if (!key || seenOnThisJob.has(key)) continue;
            seenOnThisJob.add(key);
            const existing = counts.get(key);
            if (existing) {
                existing.count += 1;
            } else {
                counts.set(key, { label, count: 1 });
            }
        }
    }
    return counts;
}

function toSortedOptions(
    counts: Map<string, { label: string; count: number }>,
): FacetOption[] {
    return Array.from(counts.entries())
        .filter(([, v]) => v.count >= MIN_COUNT)
        .sort((a, b) => b[1].count - a[1].count || a[1].label.localeCompare(b[1].label))
        .slice(0, MAX_OPTIONS_PER_FACET)
        .map(([value, v]) => ({ value, label: v.label, count: v.count }));
}

// Human-friendly labels for known scraper/source keys (matches the
// `source_name` values set by crawler/src/scrapers/*.py). Falls back to a
// title-cased version of the raw source string for anything not listed
// here, so new scrapers show up automatically without needing an edit.
const SOURCE_LABELS: Record<string, string> = {
    greenhouse: 'Greenhouse',
    lever: 'Lever',
    ashby: 'Ashby',
    smartrecruiters: 'SmartRecruiters',
    workable: 'Workable',
    recruitee: 'Recruitee',
    teamtailor: 'Teamtailor',
    bamboohr: 'BambooHR',
    breezyhr: 'Breezy HR',
    personio: 'Personio',
    freshteam: 'Freshteam',
    naukri: 'Naukri',
    internshala: 'Internshala',
    linkedin: 'LinkedIn',
    hiringcafe: 'Hiring Cafe',
    unstop: 'Unstop',
    cutshort: 'Cutshort',
    company_portals: 'Company Careers',
    remoteok: 'RemoteOK',
    weworkremotely: 'We Work Remotely',
    remotive: 'Remotive',
    employment_news: 'Employment News',
    freejobalert: 'FreeJobAlert',
    dorker: 'Web Discovery',
    generic_boards: 'Job Boards',
};

function sourceLabel(raw: string): string {
    const key = raw.toLowerCase().trim();
    return SOURCE_LABELS[key] ?? raw.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildFacetCounts(jobs: Job[]): FacetSnapshot {
    const skillCounts = countBy(jobs, (j) => j.required_skills ?? j.enriched_keywords);
    const courseCounts = countBy(jobs, (j) => j.allowed_courses);
    const batchCounts = countBy(jobs, (j) =>
        (j.allowed_passout_years ?? []).map((y) => String(y)),
    );
    const companyCounts = countBy(jobs, (j) => j.company);

    // Sources get their own path (not countBy) so the label lookup table
    // above is used instead of the raw job field as the display label.
    const rawSourceCounts = countBy(jobs, (j) => j.source);
    const sourceCounts = new Map<string, { label: string; count: number }>();
    for (const [key, v] of rawSourceCounts.entries()) {
        sourceCounts.set(key, { label: sourceLabel(v.label), count: v.count });
    }

    return {
        skills: toSortedOptions(skillCounts),
        courses: toSortedOptions(courseCounts),
        sources: toSortedOptions(sourceCounts),
        // Batches sort newest-year-first rather than by count — students
        // scan this list looking for "my year", not the most common year.
        batches: toSortedOptions(batchCounts).sort((a, b) => Number(b.value) - Number(a.value)),
        companies: toSortedOptions(companyCounts),
    };
}

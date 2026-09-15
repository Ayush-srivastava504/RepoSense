// Module: app/batch/data.ts
// Defines component(s)/export(s): BATCHES
// Defines function(s): getBatchByYear, getRelatedBatches
// Defines type(s): BatchDefinition
//
// PHASE_PLAN.md Phase 3 item 1 — batch/passout-year hub pages, mirroring
// the existing app/skills/data.ts and app/jobs-in/data.ts curated-list
// pattern rather than generating a page per arbitrary year: batches are
// filtered server-side via GET /api/jobs/?batches=2026 (routes/jobs.py's
// `allowed_passout_years` overlap match, wired through lib/jobs.ts's
// `batches` option), the same way skill/city hubs filter by
// skill/location — this file just curates which years get a static page.
//
// Range covers the graduating classes still realistically job-hunting
// right now plus the next couple of years out, since postings for a given
// passout year start appearing well before that year's students graduate.

export interface BatchDefinition {
    year: string;
    metaTitle: string;
    metaDescription: string;
    heroDescription: string;
    relatedYears: string[];
}

function batch(year: string, relatedYears: string[]): BatchDefinition {
    return {
        year,
        metaTitle: `${year} Batch Jobs & Internships for Freshers — InternFlow`,
        metaDescription: `Live jobs and internships open to the ${year} passout batch, sourced from company career pages and job boards and refreshed daily, plus the resume and interview tools to apply faster.`,
        heroDescription: `Every active job and internship on InternFlow that accepts the ${year} passout batch, aggregated from company career pages and job boards and refreshed daily — with the companies hiring and the tools to get your application ready.`,
        relatedYears,
    };
}

export const BATCHES: BatchDefinition[] = [
    batch('2025', ['2026', '2027', '2024']),
    batch('2026', ['2027', '2025', '2028']),
    batch('2027', ['2026', '2028', '2025']),
    batch('2028', ['2027', '2029', '2026']),
    batch('2029', ['2028', '2027', '2026']),
];

export function getBatchByYear(year: string): BatchDefinition | undefined {
    return BATCHES.find((b) => b.year === year);
}

export function getRelatedBatches(batchDef: BatchDefinition, limit = 4): BatchDefinition[] {
    return batchDef.relatedYears
        .map((year) => getBatchByYear(year))
        .filter((b): b is BatchDefinition => Boolean(b))
        .slice(0, limit);
}

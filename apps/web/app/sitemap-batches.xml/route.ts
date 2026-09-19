// Module: app/sitemap-batches.xml/route.ts
// Defines component(s)/export(s): GET
//
// PHASE_PLAN.md Phase 3 item 1. Uses the already-aggregated `batches`
// facet from GET /api/jobs/facets (lib/facets.ts's getJobFacets()) rather
// than one getJobs() round-trip per year — that endpoint already runs a
// single GROUP BY over the full active-jobs table server-side, so this is
// one API call total instead of BATCHES.length.

import { BASE_URL } from '@/lib/jobs';
import { getJobFacets } from '@/lib/facets';
import { BATCHES } from '@/app/batch/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { BATCH_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';
export const dynamic = 'force-dynamic';

export async function GET() {
    const facets = await getJobFacets();
    const countByYear = new Map(facets.batches.map((b) => [b.value, b.count]));
    // PHASE_PLAN.md Phase 3 item 2: skip any batch year below
    // BATCH_MIN_JOBS, matching the noindex gate
    // app/batch/[year]/page.tsx's generateMetadata applies — a sitemap
    // entry for a noindexed page is a conflicting signal. A year absent
    // from the facets response entirely (zero live jobs) counts as 0.
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/batch`, changefreq: 'weekly', priority: 0.8 },
        ...BATCHES
            .filter((b) => !belowHubThreshold(countByYear.get(b.year) ?? 0, BATCH_MIN_JOBS))
            .map((b) => ({
                loc: `${BASE_URL}/batch/${b.year}`,
                changefreq: 'daily' as const,
                priority: 0.7,
            })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

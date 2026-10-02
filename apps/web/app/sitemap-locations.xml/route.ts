// Module: app/sitemap-locations.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL, getJobsOrThrow, type Job } from '@/lib/jobs';
import { sitemapOk, sitemapUnavailable } from '@/lib/sitemapResponse';
import { CITIES, type CityDefinition } from '@/app/jobs-in/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { LOCATION_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';
export const dynamic = 'force-dynamic';

// Same matcher app/jobs-in/[city]/page.tsx uses — the jobs API only filters
// by country server-side, so city matching happens against the raw
// `location` string here too.
function matchesCity(job: Job, city: CityDefinition): boolean {
    const loc = (job.location || '').toLowerCase();
    if (!loc)
        return false;
    return city.matchers.some((m) => loc.includes(m));
}

export async function GET() {
    // One fetch of both job types, then filter per-city in memory, rather
    // than one API round-trip per city — same shape as the per-city page
    // fetch, just batched for every city up front.
    // getJobsOrThrow: an API failure would otherwise count as 0 jobs and drop EVERY city hub from the sitemap.
    let jobs: Job[];
    let internships: Job[];
    try {
        [jobs, internships] = await Promise.all([
            getJobsOrThrow({ sort: 'ranked', limit: 500 }),
            getJobsOrThrow({ type: 'internship', sort: 'ranked', limit: 500 }),
        ]);
    }
    catch (err) {
        return sitemapUnavailable('locations', err);
    }
    // PHASE_PLAN.md Phase 3 item 2: skip any city below LOCATION_MIN_JOBS,
    // matching the noindex gate app/jobs-in/[city]/page.tsx's
    // generateMetadata now applies — a sitemap entry for a noindexed page
    // is a conflicting signal.
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/jobs-in`, changefreq: 'weekly', priority: 0.8 },
        ...CITIES
            .filter((city) => {
                const count = jobs.filter((j) => matchesCity(j, city)).length +
                    internships.filter((j) => matchesCity(j, city)).length;
                return !belowHubThreshold(count, LOCATION_MIN_JOBS);
            })
            .map((city) => ({
                loc: `${BASE_URL}/jobs-in/${city.slug}`,
                changefreq: 'daily' as const,
                priority: 0.7,
            })),
    ]);
    return sitemapOk(xml);
}

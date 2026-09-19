// Module: app/sitemap-jobs.xml/route.ts
// Defines component(s)/export(s): GET
//
// Only live, indexable jobs on the canonical host (see lib/site.ts). The
// eligibility rule is the SAME function the job pages use for their own
// noindex decision (isIndexableJob), so the sitemap never contradicts a page.

import { getJobsPage } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import {
    buildJobSitemapEntries,
    collectAllJobs,
    SITEMAP_MAX_URLS,
} from '@/lib/sitemapJobs';

export const dynamic = 'force-dynamic';
// Give this route more headroom on platforms that respect it (e.g. Vercel Pro).
export const maxDuration = 60;

export async function GET() {
    try {
        const jobs = await collectAllJobs((offset, limit) => getJobsPage({ limit, offset }));
        let entries = buildJobSitemapEntries(jobs);
        if (entries.length > SITEMAP_MAX_URLS) {
            // Over the 50k-per-file protocol limit: split into multiple sitemap files.
            console.error(`sitemap-jobs: ${entries.length} entries exceeds ${SITEMAP_MAX_URLS}; truncating`);
            entries = entries.slice(0, SITEMAP_MAX_URLS);
        }
        return new Response(buildUrlsetXml(entries), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                // Edge-cache so Googlebot fetches don't each fan out ~30 API calls.
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    }
    catch (err) {
        // 503 (not a partial/empty 200): Google keeps the last good sitemap and retries.
        console.error('Failed to build jobs sitemap:', err);
        return new Response('Sitemap temporarily unavailable', {
            status: 503,
            headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' },
        });
    }
}

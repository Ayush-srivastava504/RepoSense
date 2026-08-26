// Module: app/sitemap-jobs.xml/route.ts
// Defines component(s)/export(s): PAGE_SIZE, MAX_PAGES, GET
//
//

import { canonicalPathForJob } from '@/lib/slug';
import { getJobs, BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
// Give this route more headroom on platforms that respect it (e.g. Vercel Pro).
// Harmless no-op elsewhere.
export const maxDuration = 60;
const PAGE_SIZE = 500;
const MAX_PAGES = 30;
export async function GET() {
    let jobs: Awaited<ReturnType<typeof getJobs>> = [];
    try {
        // Fetch all pages concurrently instead of awaiting them one at a time — up to
        // 30 sequential round trips easily exceeds a serverless function's timeout,
        // which cuts the response off mid-write and drops the closing </urlset> tag
        // (surfaces in Search Console as "Sitemap can be read, but has errors —
        // Missing XML tag"). Running them in parallel bounds wall time to the
        // slowest single request rather than the sum of all of them.
        const pages = await Promise.allSettled(Array.from({ length: MAX_PAGES }, (_, page) => getJobs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE })));
        for (const result of pages) {
            // Assemble in order and stop at the first failed or short page, so we
            // never splice in a later page while silently skipping a failed earlier
            // one and leaving a gap in the sitemap.
            if (result.status !== 'fulfilled')
                break;
            jobs = jobs.concat(result.value);
            if (result.value.length < PAGE_SIZE)
                break;
        }
    }
    catch (err) {
        console.error('Failed to build jobs sitemap:', err);
    }
    // Only ship currently-live listings. Shipping the full historical backlog
    // (including jobs past their application deadline) hands Google tens of
    // thousands of URLs a day that are no longer worth crawling, which is a
    // large part of why "Discovered – currently not indexed" keeps climbing —
    // it trains Google to treat this sitemap as low-value.
    const now = Date.now();
    const isLive = (job: (typeof jobs)[number]) => {
        if (!job.deadline)
            return true;
        const deadline = new Date(job.deadline).getTime();
        return Number.isNaN(deadline) || deadline >= now;
    };
    const xml = buildUrlsetXml(jobs
        .filter((job) => job?.id)
        .filter(isLive)
        .map((job) => ({
        loc: `${BASE_URL}${canonicalPathForJob(job)}`,
        lastmod: job.posted_at ? new Date(job.posted_at).toISOString() : new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.8,
    })));
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

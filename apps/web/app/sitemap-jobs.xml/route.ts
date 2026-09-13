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
        // Fetch pages in small concurrent batches rather than either (a) fully
        // sequentially, which for a large job count can exceed a serverless
        // function's timeout and cut the response off mid-write, dropping the
        // closing </urlset> tag (Search Console: "Missing XML tag"), or (b) all
        // MAX_PAGES at once, which fires 30 requests from one IP against an API
        // that rate-limits unauthenticated callers at 50/min — a burst that size
        // alone eats most of the budget, and getJobs() swallows a 429 into an
        // empty array, which this loop then reads as "no more pages" and stops
        // at page 1, producing an empty sitemap. Batching keeps concurrency (and
        // therefore requests-per-minute) low while still bounding wall time, and
        // the common case of a few hundred jobs only ever needs one batch.
        const BATCH_CONCURRENCY = 5;
        outer: for (let batchStart = 0; batchStart < MAX_PAGES; batchStart += BATCH_CONCURRENCY) {
            const batchPages = Array.from(
                { length: Math.min(BATCH_CONCURRENCY, MAX_PAGES - batchStart) },
                (_, i) => batchStart + i
            );
            const results = await Promise.allSettled(
                batchPages.map((page) => getJobs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }))
            );
            for (const result of results) {
                // Assemble in order and stop at the first failed or short page, so we
                // never splice in a later page while silently skipping a failed earlier
                // one and leaving a gap in the sitemap.
                if (result.status !== 'fulfilled')
                    break outer;
                jobs = jobs.concat(result.value);
                if (result.value.length < PAGE_SIZE)
                    break outer;
            }
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

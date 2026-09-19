// Module: app/sitemap-hackathons.xml/route.ts
// Defines component(s)/export(s): PAGE_SIZE, MAX_PAGES, GET
//
//

import { getHackathons, BASE_URL } from '@/lib/hackathons';
import { buildUrlsetXml, toLastmod } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
// Give this route more headroom on platforms that respect it (e.g. Vercel Pro).
// Harmless no-op elsewhere.
export const maxDuration = 60;
const PAGE_SIZE = 50;
const MAX_PAGES = 20;
export async function GET() {
    let hackathons: Awaited<ReturnType<typeof getHackathons>> = [];
    try {
        // Fetch pages in small concurrent batches rather than either (a) fully
        // sequentially, which can exceed a serverless function's timeout and cut
        // the response off mid-write, dropping the closing </urlset> tag (Search
        // Console: "Missing XML tag"), or (b) all MAX_PAGES at once, which fires a
        // burst of requests from one IP against an API that rate-limits
        // unauthenticated callers per minute — a large enough burst eats most of
        // that budget on its own, and getHackathons() swallows a failed request
        // into an empty array, which this loop then reads as "no more pages" and
        // stops immediately, producing an empty sitemap. Batching keeps
        // concurrency (and requests-per-minute) low while still bounding wall
        // time, and the common case only ever needs one batch.
        const BATCH_CONCURRENCY = 5;
        outer: for (let batchStart = 0; batchStart < MAX_PAGES; batchStart += BATCH_CONCURRENCY) {
            const batchPages = Array.from(
                { length: Math.min(BATCH_CONCURRENCY, MAX_PAGES - batchStart) },
                (_, i) => batchStart + i
            );
            const results = await Promise.allSettled(
                batchPages.map((page) => getHackathons({ limit: PAGE_SIZE, offset: page * PAGE_SIZE }))
            );
            for (const result of results) {
                // Assemble in order and stop at the first failed or short page, so we
                // never splice in a later page while silently skipping a failed earlier
                // one and leaving a gap in the sitemap.
                if (result.status !== 'fulfilled')
                    break outer;
                hackathons = hackathons.concat(result.value);
                if (result.value.length < PAGE_SIZE)
                    break outer;
            }
        }
    }
    catch (err) {
        console.error('Failed to build hackathons sitemap:', err);
    }
    const xml = buildUrlsetXml(hackathons
        .filter((hackathon) => hackathon?.slug)
        .map((hackathon) => ({
        loc: `${BASE_URL}/hackathons/${hackathon.slug}`,
        lastmod: toLastmod(hackathon.first_seen_at),
        changefreq: 'daily' as const,
        priority: 0.7,
    })));
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

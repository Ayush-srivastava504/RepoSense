// Module: app/sitemap-jobs.xml/route.ts
// Defines component(s)/export(s): PAGE_SIZE, MAX_PAGES, GET
//
//

import { canonicalPathForJob } from '@/lib/slug';
import { getJobs, BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
const PAGE_SIZE = 500;
const MAX_PAGES = 30;
export async function GET() {
    const jobs: Awaited<ReturnType<typeof getJobs>> = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const batch = await getJobs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
        jobs.push(...batch);
        if (batch.length < PAGE_SIZE)
            break;
    }
    const xml = buildUrlsetXml(jobs
        .filter((job) => job?.id)
        .map((job) => ({
        loc: `${BASE_URL}${canonicalPathForJob(job)}`,
        lastmod: job.posted_at ? new Date(job.posted_at).toISOString() : new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.8,
    })));
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

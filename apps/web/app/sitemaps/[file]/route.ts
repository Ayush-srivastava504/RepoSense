// Module: app/sitemaps/[file]/route.ts
// Serves /sitemaps/{jobs|internships|remote-jobs|government-jobs}-{page}.xml
//
// Each file holds up to SITEMAP_URLS_PER_FILE priority URLs (recent + enriched
// jobs; see isJobForSitemap). This is sitemap-only: page-level noindex rules
// are unchanged.

import { parseSitemapFileName } from '@/lib/sitemapJobs';
import { getSitemapFileXml } from '@/lib/sitemapJobsSource';
import { sitemapOk, sitemapUnavailable } from '@/lib/sitemapResponse';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { file: string } }) {
    const parsed = parseSitemapFileName(params.file);
    if (!parsed)
        return new Response('Not found', { status: 404 });
    try {
        const xml = await getSitemapFileXml(params.file);
        if (xml === null)
            return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=300' } });
        return sitemapOk(xml, `file:${params.file}`);
    }
    catch (err) {
        // Last good copy of this file if we have one; else 503 (Google keeps its last good copy and retries).
        return sitemapUnavailable(`file:${params.file}`, err);
    }
}

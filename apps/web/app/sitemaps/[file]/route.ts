// Module: app/sitemaps/[file]/route.ts
// Serves /sitemaps/{jobs|internships|remote-jobs|government-jobs}-{page}.xml
//
// Each file holds up to SITEMAP_URLS_PER_FILE priority URLs (recent + enriched
// jobs; see isJobForSitemap). This is sitemap-only: page-level noindex rules
// are unchanged.

import { buildUrlsetXml } from '@/lib/sitemapXml';
import { chunkEntries, parseSitemapFileName } from '@/lib/sitemapJobs';
import { getCategorySitemaps } from '@/lib/sitemapJobsSource';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(_req: Request, { params }: { params: { file: string } }) {
    const parsed = parseSitemapFileName(params.file);
    if (!parsed)
        return new Response('Not found', { status: 404 });
    try {
        const buckets = await getCategorySitemaps();
        const chunk = chunkEntries(buckets[parsed.category])[parsed.page - 1];
        if (!chunk)
            return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'public, s-maxage=300' } });
        return new Response(buildUrlsetXml(chunk), {
            headers: {
                'Content-Type': 'application/xml; charset=utf-8',
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
            },
        });
    }
    catch (err) {
        // 503 (not a partial/empty 200): Google keeps its last good copy and retries.
        console.error('Failed to build category sitemap:', err);
        return new Response('Sitemap temporarily unavailable', {
            status: 503,
            headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' },
        });
    }
}

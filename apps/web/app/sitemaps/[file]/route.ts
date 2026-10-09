// Module: app/sitemaps/[file]/route.ts
// Serves /sitemaps/{jobs|internships|remote-jobs|government-jobs}-{page}.xml
//
// Each file holds up to SITEMAP_URLS_PER_FILE priority URLs (recent + enriched
// jobs; see isJobForSitemap). This is sitemap-only: page-level noindex rules
// are unchanged.
//
// These files are prebuilt hourly by the API (sitemap_cache) and are the sitemaps Search Console already reads daily.
// They go through the same answer policy as every other sitemap (lib/sitemapResponse.ts). Unlike the route sitemaps
// they have no static fallback -- the URLs only exist in the API -- so the very last resort stays a 503, reached only
// when the Data Cache, this instance's copy AND the API are all unavailable at once.
import { parseSitemapFileName } from '@/lib/sitemapJobs';
import { getSitemapFileXml } from '@/lib/sitemapJobsSource';
import { serveSitemap } from '@/lib/sitemapResponse';
import { newestLastmod } from '@/lib/sitemapDates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LASTMOD_RX = /<lastmod>\s*([^<\s]+)\s*<\/lastmod>/g;

export async function GET(req: Request, { params }: { params: { file: string } }) {
    const parsed = parseSitemapFileName(params.file);
    if (!parsed)
        return new Response('Not found', { status: 404 });
    return serveSitemap(`file:${params.file}`, async () => {
        const xml = await getSitemapFileXml(params.file);
        if (xml === null)
            return null; // the API says the file does not exist -> 404
        return { xml, lastmod: newestLastmod([...xml.matchAll(LASTMOD_RX)].map((m) => m[1])) };
    }, undefined, req);
}

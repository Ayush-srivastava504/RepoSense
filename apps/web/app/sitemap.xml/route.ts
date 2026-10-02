// Module: app/sitemap.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getSitemapCategories, getSitemapFileList, sitemapFileUrls } from '@/lib/sitemapJobsSource';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET() {
    let jobSitemaps: string[];
    try {
        jobSitemaps = sitemapFileUrls(await getSitemapFileList());
    }
    catch (err) {
        // Don't publish an index that silently drops the job files: 503 makes
        // Google keep the last good index and retry.
        console.error('Failed to build sitemap index:', err);
        return new Response('Sitemap temporarily unavailable', {
            status: 503,
            headers: { 'Retry-After': '900', 'Cache-Control': 'no-store' },
        });
    }
    // Built-in list = the pre-registry behaviour; used only if /api/sitemap/categories is unavailable.
    const FALLBACK_ROUTE_PATHS = [
        '/sitemap-static.xml',
        '/sitemap-hackathons.xml',
        '/sitemap-tools.xml',
        '/sitemap-blog.xml',
        '/sitemap-skills.xml',
        '/sitemap-companies.xml',
        '/sitemap-locations.xml',
        '/sitemap-batches.xml',
        '/sitemap-resume.xml',
        '/sitemap-careers.xml',
    ];
    const categories = await getSitemapCategories();
    let sitemaps: string[];
    if (categories) {
        // Registry order is authoritative. Job categories expand to their prebuilt files; a
        // disabled job category has no files in sitemap_cache after the next build, so it
        // drops out of jobSitemaps on its own, but filter here too so the index flips at once.
        const enabledJobSlugs = new Set(categories.filter((c) => c.kind === 'job_cache').map((c) => c.slug));
        const fileSitemaps = jobSitemaps.filter((loc) => {
            const slug = loc.split('/').pop()?.replace(/-\d+\.xml$/, '') ?? '';
            return enabledJobSlugs.has(slug);
        });
        sitemaps = [];
        let jobsInserted = false;
        for (const c of categories) {
            if (c.kind === 'route' && c.path) {
                sitemaps.push(`${BASE_URL}${c.path}`);
            }
            else if (c.kind === 'job_cache' && !jobsInserted) {
                sitemaps.push(...fileSitemaps);
                jobsInserted = true;
            }
        }
    }
    else {
        const [first, ...rest] = FALLBACK_ROUTE_PATHS.map((p) => `${BASE_URL}${p}`);
        sitemaps = [first, ...jobSitemaps, ...rest];
    }
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
        .map((loc) => `  <sitemap>
    <loc>${loc}</loc>
  </sitemap>`)
        .join('\n')}
</sitemapindex>`;
    return new Response(body, {
        headers: {
            'Content-Type': 'application/xml',
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
        },
    });
}

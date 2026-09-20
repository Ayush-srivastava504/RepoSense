// Module: app/sitemap.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { categorySitemapUrls } from '@/lib/sitemapJobs';
import { getCategorySitemaps } from '@/lib/sitemapJobsSource';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export async function GET() {
    let jobSitemaps: string[];
    try {
        jobSitemaps = categorySitemapUrls(await getCategorySitemaps());
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
    const sitemaps = [
        `${BASE_URL}/sitemap-static.xml`,
        ...jobSitemaps,
        `${BASE_URL}/sitemap-hackathons.xml`,
        `${BASE_URL}/sitemap-tools.xml`,
        `${BASE_URL}/sitemap-blog.xml`,
        `${BASE_URL}/sitemap-skills.xml`,
        `${BASE_URL}/sitemap-companies.xml`,
        `${BASE_URL}/sitemap-locations.xml`,
        `${BASE_URL}/sitemap-batches.xml`,
        `${BASE_URL}/sitemap-resume.xml`,
        `${BASE_URL}/sitemap-careers.xml`,
    ];
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

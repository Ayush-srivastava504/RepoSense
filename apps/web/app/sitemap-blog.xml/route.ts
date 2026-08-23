// Module: app/sitemap-blog.xml/route.ts
// Defines component(s)/export(s): GET
//
//

import { BASE_URL } from '@/lib/jobs';
import { getAllPosts } from '@/lib/blog';
import { buildUrlsetXml } from '@/lib/sitemapXml';
export const dynamic = 'force-dynamic';
export async function GET() {
    const now = new Date().toISOString();
    const posts = getAllPosts();
    const xml = buildUrlsetXml([
        { loc: `${BASE_URL}/blog`, lastmod: now, changefreq: 'daily', priority: 0.8 },
        ...posts.map((post) => ({
            loc: `${BASE_URL}/blog/${post.slug}`,
            lastmod: post.updatedAt || post.publishedAt,
            changefreq: 'monthly' as const,
            priority: 0.6,
        })),
    ]);
    return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

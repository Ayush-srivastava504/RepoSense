// Module: app/sitemap-blog.xml/route.ts
// Defines component(s)/export(s): GET

import { BASE_URL } from '@/lib/jobs';
import { getAllPosts } from '@/lib/blog';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { hreflangLinks } from '@/lib/hreflang';

export const dynamic = 'force-dynamic';

export async function GET() {
  const posts = getAllPosts();

  // Empty while hreflang is disabled (lib/hreflang.ts).
  const blogIndexAlternates = hreflangLinks('/blog');

  const entries = [
    {
      loc: `${BASE_URL}/blog`,
      changefreq: 'daily' as const,
      priority: 0.9,
      alternates: blogIndexAlternates,
    },
    ...posts.map((post) => {
      const postAlternates = hreflangLinks(`/blog/${post.slug}`);

      return {
        loc: `${BASE_URL}/blog/${post.slug}`,
        lastmod: post.updatedAt || post.publishedAt,
        changefreq: 'weekly' as const,
        priority: 0.8,
        alternates: postAlternates,
      };
    }),
  ];

  const xml = buildUrlsetXml(entries);
  return new Response(xml, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
}

// Module: app/sitemap-blog.xml/route.ts
// Defines component(s)/export(s): GET

import { BASE_URL } from '@/lib/jobs';
import { getAllPosts } from '@/lib/blog';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { i18n } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();
  const posts = getAllPosts();

  const blogIndexAlternates: { lang: string; href: string }[] = i18n.locales.map((loc) => ({
    lang: loc,
    href: loc === 'en' ? `${BASE_URL}/blog` : `${BASE_URL}/${loc}/blog`,
  }));
  blogIndexAlternates.push({ lang: 'x-default', href: `${BASE_URL}/blog` });

  const entries = [
    {
      loc: `${BASE_URL}/blog`,
      lastmod: now,
      changefreq: 'daily' as const,
      priority: 0.9,
      alternates: blogIndexAlternates,
    },
    ...posts.map((post) => {
      const postAlternates: { lang: string; href: string }[] = i18n.locales.map((loc) => ({
        lang: loc,
        href: loc === 'en' ? `${BASE_URL}/blog/${post.slug}` : `${BASE_URL}/${loc}/blog/${post.slug}`,
      }));
      postAlternates.push({ lang: 'x-default', href: `${BASE_URL}/blog/${post.slug}` });

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

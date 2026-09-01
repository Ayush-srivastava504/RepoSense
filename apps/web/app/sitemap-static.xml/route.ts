// Module: app/sitemap-static.xml/route.ts
// Defines component(s)/export(s): GET

import { BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';
import { i18n } from '@/i18n/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();

  // Primary static hubs with multilingual support
  const coreHubs = [
    { path: '', changefreq: 'daily' as const, priority: 1.0 },
    { path: '/jobs', changefreq: 'daily' as const, priority: 0.9 },
    { path: '/internships', changefreq: 'daily' as const, priority: 0.9 },
    { path: '/remote-jobs', changefreq: 'daily' as const, priority: 0.9 },
    { path: '/government-jobs', changefreq: 'daily' as const, priority: 0.9 },
    { path: '/companies', changefreq: 'daily' as const, priority: 0.8 },
    { path: '/hackathons', changefreq: 'daily' as const, priority: 0.8 },
    { path: '/japan-jobs', changefreq: 'daily' as const, priority: 0.8 },
    { path: '/europe-jobs', changefreq: 'daily' as const, priority: 0.8 },
    { path: '/tools', changefreq: 'weekly' as const, priority: 0.8 },
    { path: '/about', changefreq: 'monthly' as const, priority: 0.6 },
    { path: '/leetcode', changefreq: 'weekly' as const, priority: 0.7 },
    { path: '/resume/builder', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/ats-checker', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/cover-letter', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/github', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/linkedin', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/register', changefreq: 'monthly' as const, priority: 0.6 },
    { path: '/login', changefreq: 'monthly' as const, priority: 0.5 },
  ];

  const entries = coreHubs.map((hub) => {
    const alternates: { lang: string; href: string }[] = i18n.locales.map((loc) => ({
      lang: loc,
      href: loc === 'en' ? `${BASE_URL}${hub.path}` : `${BASE_URL}/${loc}${hub.path}`,
    }));
    alternates.push({ lang: 'x-default', href: `${BASE_URL}${hub.path}` });

    return {
      loc: `${BASE_URL}${hub.path}`,
      lastmod: now,
      changefreq: hub.changefreq,
      priority: hub.priority,
      alternates,
    };
  });

  const xml = buildUrlsetXml(entries);
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

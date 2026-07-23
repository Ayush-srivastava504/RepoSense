import { BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();

  const xml = buildUrlsetXml([
    { loc: BASE_URL, lastmod: now, changefreq: 'weekly', priority: 1.0 },
    { loc: `${BASE_URL}/about`, lastmod: now, changefreq: 'monthly', priority: 0.6 },
    { loc: `${BASE_URL}/register`, lastmod: now, changefreq: 'monthly', priority: 0.9 },
    { loc: `${BASE_URL}/login`, lastmod: now, changefreq: 'monthly', priority: 0.5 },
    { loc: `${BASE_URL}/jobs`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${BASE_URL}/internships`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${BASE_URL}/remote-jobs`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${BASE_URL}/government-jobs`, lastmod: now, changefreq: 'daily', priority: 0.9 },
  ]);

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

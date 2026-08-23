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
    { loc: `${BASE_URL}/companies`, lastmod: now, changefreq: 'daily', priority: 0.7 },
    { loc: `${BASE_URL}/hackathons`, lastmod: now, changefreq: 'daily', priority: 0.9 },
    { loc: `${BASE_URL}/tracker`, lastmod: now, changefreq: 'weekly', priority: 0.6 },
    // /japan-jobs and /japan-internships were merged into one page with a
    // tab toggle (see app/japan-jobs/page.tsx); list both indexable
    // variants here instead of the old separate URL, which now 308s.
    { loc: `${BASE_URL}/japan-jobs`, lastmod: now, changefreq: 'daily', priority: 0.8 },
    { loc: `${BASE_URL}/japan-jobs?type=internship`, lastmod: now, changefreq: 'daily', priority: 0.8 },
    { loc: `${BASE_URL}/europe-jobs`, lastmod: now, changefreq: 'daily', priority: 0.8 },
    { loc: `${BASE_URL}/leetcode`, lastmod: now, changefreq: 'weekly', priority: 0.7 },
  ]);

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

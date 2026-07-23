import { BASE_URL } from '@/lib/jobs';
import { TOOLS } from '@/app/tools/data';
import { buildUrlsetXml } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';

export async function GET() {
  const now = new Date().toISOString();

  const xml = buildUrlsetXml([
    { loc: `${BASE_URL}/tools`, lastmod: now, changefreq: 'weekly', priority: 0.8 },
    ...TOOLS.map((tool) => ({
      loc: `${BASE_URL}/tools/${tool.slug}`,
      lastmod: now,
      changefreq: 'weekly' as const,
      priority: 0.7,
    })),
  ]);

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

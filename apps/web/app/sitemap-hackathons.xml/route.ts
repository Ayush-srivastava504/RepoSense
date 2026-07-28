import { getHackathons, BASE_URL } from '@/lib/hackathons';
import { buildUrlsetXml } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50; // backend /api/hackathons hard-caps `limit` at 50 per call
const MAX_PAGES = 20; // safety ceiling: 1,000 hackathons, well above current volume

export async function GET() {
  const hackathons: Awaited<ReturnType<typeof getHackathons>> = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await getHackathons({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    hackathons.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const xml = buildUrlsetXml(
    hackathons
      .filter((hackathon) => hackathon?.slug)
      .map((hackathon) => ({
        loc: `${BASE_URL}/hackathons/${hackathon.slug}`,
        lastmod: hackathon.first_seen_at
          ? new Date(hackathon.first_seen_at).toISOString()
          : new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.7,
      }))
  );

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

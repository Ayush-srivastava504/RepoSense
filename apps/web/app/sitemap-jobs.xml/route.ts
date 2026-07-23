import { jobSlug } from '@/lib/slug';
import { getJobs, BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';

export async function GET() {
  // getJobs() already filters to is_active = true (expired/removed jobs are
  // never in this list — see /api/jobs). Every job gets exactly ONE sitemap
  // entry at its canonical URL: /jobs/[slug], even for internship-type
  // postings, since /internships/[slug] canonicalizes back to that same
  // URL. Listing two URLs per job here would fight Google's own duplicate
  // content handling instead of relying on the canonical tag.
  const jobs = await getJobs({ limit: 500 });

  const xml = buildUrlsetXml(
    jobs
      .filter((job) => job?.id)
      .map((job) => ({
        loc: `${BASE_URL}/jobs/${jobSlug(job)}`,
        lastmod: job.posted_at ? new Date(job.posted_at).toISOString() : new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.8,
      }))
  );

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

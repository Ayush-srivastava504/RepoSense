import { canonicalPathForJob } from '@/lib/slug';
import { getJobs, BASE_URL } from '@/lib/jobs';
import { buildUrlsetXml } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 500; // backend /api/jobs hard-caps `limit` at 500 per call
const MAX_PAGES = 30; // safety ceiling: 15,000 jobs, well above current volume

export async function GET() {
  // getJobs() already filters to is_active = true (expired/removed jobs are
  // never in this list — see /api/jobs). Every job gets exactly ONE sitemap
  // entry, at whatever path canonicalPathForJob() says is canonical for it
  // (/internships/, /remote-jobs/, /government-jobs/, or /jobs/ as the
  // fallback). This MUST use the same helper as the detail pages'
  // `alternates.canonical` — if this ever hardcodes /jobs/ again while a
  // category page self-canonicalizes to its own path, Google gets a
  // sitemap entry and a canonical tag pointing at two different URLs for
  // the same job, which is the exact conflict this replaced.
  //
  // The backend caps `limit` at 500 per request, so a single getJobs() call
  // silently truncates the sitemap once active jobs pass 500. We page
  // through with offset until a page comes back short.
  const jobs: Awaited<ReturnType<typeof getJobs>> = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const batch = await getJobs({ limit: PAGE_SIZE, offset: page * PAGE_SIZE });
    jobs.push(...batch);
    if (batch.length < PAGE_SIZE) break;
  }

  const xml = buildUrlsetXml(
    jobs
      .filter((job) => job?.id)
      .map((job) => ({
        loc: `${BASE_URL}${canonicalPathForJob(job)}`,
        lastmod: job.posted_at ? new Date(job.posted_at).toISOString() : new Date().toISOString(),
        changefreq: 'daily' as const,
        priority: 0.8,
      }))
  );

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } });
}

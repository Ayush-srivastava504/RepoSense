import { MetadataRoute } from 'next';
import { jobSlug } from '@/lib/slug';
import { getJobs, BASE_URL } from '@/lib/jobs';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/jobs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/internships`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  // getJobs() already filters to is_active = true (expired/removed jobs are
  // never in this list — see /api/jobs). Every job gets exactly ONE sitemap
  // entry at its canonical URL: /jobs/[slug], even for internship-type
  // postings, since /internships/[slug] canonicalizes back to that same
  // URL. Listing two URLs per job here would fight Google's own duplicate
  // content handling instead of relying on the canonical tag.
  const jobs = await getJobs({ limit: 500 });

  const jobRoutes: MetadataRoute.Sitemap = jobs
    .filter((job) => job?.id)
    .map((job) => ({
      url: `${BASE_URL}/jobs/${jobSlug(job)}`,
      lastModified: job.posted_at ? new Date(job.posted_at) : new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }));

  return [...staticRoutes, ...jobRoutes];
}

// app/sitemap.ts
import { MetadataRoute } from 'next';
import { getActiveJobListings } from '@/lib/jobs'; // your data source

const BASE_URL = 'https://intern-flow.in';

export const revalidate = 3600; // regenerate hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/jobs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  let jobs: { slug: string; updatedAt: Date | string }[] = [];
  try {
    jobs = await getActiveJobListings();
  } catch (err) {
    console.error('sitemap: failed to load job listings', err);
    jobs = [];
  }

  const jobRoutes: MetadataRoute.Sitemap = jobs
    .filter((job) => job?.slug)
    .map((job) => ({
      url: `${BASE_URL}/jobs/${job.slug}`,
      lastModified: job.updatedAt ? new Date(job.updatedAt) : new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    }));

  return [...staticRoutes, ...jobRoutes];
}
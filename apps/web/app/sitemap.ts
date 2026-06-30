import { MetadataRoute } from 'next';
import { jobSlug } from '@/lib/slug';

const BASE_URL = 'https://intern-flow.in';

interface Job {
  id: string;
  title: string;
  company: string;
  posted_at?: string;
}

async function getActiveJobListings(): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const res = await fetch(
      `${process.env.API_BASE_URL}/api/jobs/?limit=500`,
      { next: { revalidate: 3600 } }
    );

    if (!res.ok) {
      console.error('Jobs API returned', res.status);
      return [];
    }

    const data = await res.json();

    if (Array.isArray(data)) return data;
    if (Array.isArray(data.jobs)) return data.jobs;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;

    return [];
  } catch (err) {
    console.error('Failed to fetch jobs for sitemap:', err);
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${BASE_URL}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${BASE_URL}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${BASE_URL}/jobs`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
  ];

  const jobs = await getActiveJobListings();

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

import type { Metadata } from 'next';
import Link from 'next/link';
import { jobSlug } from '@/lib/slug';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://intern-flow.in';

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  posted_at: string;
  location?: string;
}

export const metadata: Metadata = {
  title: 'Internship Listings — Refreshed Daily',
  description:
    'Browse the latest software, AI/ML, and data internships from top companies in India. Updated daily.',
  alternates: { canonical: `${BASE_URL}/jobs` },
};

async function getPublicJobs(): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/?limit=100`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      console.error('Jobs API returned', res.status);
      return [];
    }
    const data = await res.json();
    console.log('Jobs API response keys:', Object.keys(data));
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.jobs)) return data.jobs;
    if (Array.isArray(data.data)) return data.data;
    if (Array.isArray(data.results)) return data.results;
    return [];
  } catch (err) {
    console.error('Failed to fetch jobs:', err);
    return [];
  }
}

export default async function PublicJobsPage() {
  const jobs = await getPublicJobs();

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${BASE_URL}/jobs/${jobSlug(job)}`,
    })),
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <p className="eyebrow eyebrow-accent">// internships</p>
      <h1 className="display mt-2 text-3xl font-medium">Latest postings</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
        Pulled from multiple sources and refreshed daily.
      </p>

      {jobs.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${jobSlug(job)}`}
              className="panel flex flex-col p-5"
            >
              <p className="eyebrow">
                {job.source} · {new Date(job.posted_at).toLocaleDateString()}
              </p>
              {job.location && (
                <span className="chip chip-muted mt-1 text-[0.65rem]">{job.location}</span>
              )}
              <h2
                className="display mt-2 text-base font-medium leading-snug"
                style={{ color: 'var(--ink)' }}
              >
                {job.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>{job.company}</p>
              <p
                className="mt-3 flex-1 text-sm leading-relaxed"
                style={{ color: 'var(--ink-soft)' }}
              >
                {job.description?.substring(0, 140)}…
              </p>
            </Link>
          ))}
        </div>
      ) : (
        <p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
          No internships found right now — check back soon.
        </p>
      )}
    </main>
  );
}
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
  type?: string;
}

export const metadata: Metadata = {
  title: 'Internship Listings — Refreshed Daily',
  description:
    'Browse the latest software, AI/ML, and data internships from top companies in India. Updated daily.',
  alternates: { canonical: `${BASE_URL}/jobs` },
};

async function getPublicJobs(search?: string): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({ limit: '200' });
    if (search) params.set('search', search);

    const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/?${params}`, {
      next: { revalidate: 3600 },
    });
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
    console.error('Failed to fetch jobs:', err);
    return [];
  }
}

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: { search?: string };
}) {
  const search = searchParams.search?.trim() || '';
  const jobs = await getPublicJobs(search);

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

      <form method="GET" action="/jobs" className="mt-6">
        <div className="flex gap-2">
          <input
            type="text"
            name="search"
            defaultValue={search}
            placeholder="Search by title, company, or location..."
            className="flex-1 rounded-md border px-4 py-2 text-sm"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--ink)',
            }}
          />
          <button type="submit" className="btn btn-primary px-5 py-2 text-sm">
            Search
          </button>
          {search && (
            <a href="/jobs" className="btn px-4 py-2 text-sm">
              Clear
            </a>
          )}
        </div>
        {search && (
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {jobs.length} result{jobs.length !== 1 ? 's' : ''} for &quot;{search}&quot;
          </p>
        )}
      </form>

      {jobs.length > 0 ? (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <Link
              key={job.id}
              href={`/jobs/${jobSlug(job)}`}
              className="panel flex flex-col p-5"
            >
              <div className="flex items-center justify-between">
                <p className="eyebrow">
                  {job.source || 'unknown'} ·{' '}
                  {job.posted_at
                    ? new Date(job.posted_at).toLocaleDateString()
                    : 'Recent'}
                </p>
                {job.type && (
                  <span className="chip chip-muted text-[0.65rem]">{job.type}</span>
                )}
              </div>
              {job.location && (
                <span className="chip chip-muted mt-1 text-[0.65rem]">{job.location}</span>
              )}
              <h2
                className="display mt-2 text-base font-medium leading-snug"
                style={{ color: 'var(--ink)' }}
              >
                {job.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {job.company}
              </p>
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
          {search
            ? `No results for "${search}" — try a different keyword.`
            : 'No internships found right now — check back soon.'}
        </p>
      )}
    </main>
  );
}
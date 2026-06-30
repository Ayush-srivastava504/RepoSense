import type { Metadata } from 'next';
import Link from 'next/link';
import { jobSlug } from '@/lib/slug';
import AdSlot from '@/app/components/AdSlot';

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
  alternates: {
    canonical: `${BASE_URL}/jobs`,
  },
};

async function getPublicJobs(search?: string): Promise<Job[]> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return [];
  }

  try {
    const params = new URLSearchParams({
      limit: '500', // increased from 200
    });

    if (search) {
      params.set('search', search);
    }

    const res = await fetch(
      `${process.env.API_BASE_URL}/api/jobs/?${params.toString()}`,
      {
        next: {
          revalidate: 3600,
        },
      }
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
    console.error('Failed to fetch jobs:', err);
    return [];
  }
}

export default async function PublicJobsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
  };
}) {
  const search = searchParams.search?.trim() || '';
  const jobs = await getPublicJobs(search);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${BASE_URL}/jobs/${jobSlug(job)}`,
    })),
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-4 py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListSchema),
          }}
        />

        <p className="eyebrow eyebrow-accent">// internships</p>

        <h1 className="display mt-2 text-3xl font-medium">
          Latest Postings
        </h1>

        <p
          className="mt-2 text-sm"
          style={{
            color: 'var(--ink-soft)',
          }}
        >
          Browse up to 500 internship opportunities aggregated from multiple
          platforms and refreshed daily.
        </p>

        <form
          method="GET"
          action="/jobs"
          className="mt-8"
        >
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search title, company, skills, location..."
              className="flex-1 rounded-lg border px-4 py-3 text-sm"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--ink)',
              }}
            />

            <button
              type="submit"
              className="btn btn-primary px-6 py-3 text-sm"
            >
              Search
            </button>

            {search && (
              <Link
                href="/jobs"
                className="btn px-6 py-3 text-sm"
              >
                Clear
              </Link>
            )}
          </div>

          {search && (
            <p
              className="mt-3 text-sm"
              style={{
                color: 'var(--ink-soft)',
              }}
            >
              {jobs.length} result
              {jobs.length !== 1 ? 's' : ''} found for "{search}"
            </p>
          )}
        </form>

        <AdSlot slot="3995254749" format="auto" className="mt-10" />

        {jobs.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <Link
                key={job.id}
                href={`/jobs/${jobSlug(job)}`}
                className="panel flex h-full flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <p className="eyebrow">
                    {job.source || 'Unknown'} ·{' '}
                    {job.posted_at
                      ? new Date(job.posted_at).toLocaleDateString()
                      : 'Recent'}
                  </p>

                  {job.type && (
                    <span className="chip chip-muted text-[11px]">
                      {job.type}
                    </span>
                  )}
                </div>

                {job.location && (
                  <span className="chip chip-muted mt-2 w-fit text-[11px]">
                    {job.location}
                  </span>
                )}

                <h2
                  className="display mt-4 text-lg font-medium leading-snug"
                  style={{
                    color: 'var(--ink)',
                  }}
                >
                  {job.title}
                </h2>

                <p
                  className="mt-1 text-sm"
                  style={{
                    color: 'var(--ink-soft)',
                  }}
                >
                  {job.company}
                </p>

                <p
                  className="mt-4 flex-1 text-sm leading-7"
                  style={{
                    color: 'var(--ink-soft)',
                  }}
                >
                  {job.description
                    ? `${job.description.substring(0, 180)}...`
                    : 'No description available.'}
                </p>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p
              className="text-sm"
              style={{
                color: 'var(--muted)',
              }}
            >
              {search
                ? `No internships found for "${search}".`
                : 'No internships are available right now. Please check again later.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
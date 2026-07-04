import type { Metadata } from 'next';
import Link from 'next/link';
import { jobSlug } from '@/lib/slug';
import { getJobs, getFeaturedJobs, BASE_URL } from '@/lib/jobs';
import AdSlot from '@/app/components/AdSlot';
import JobCard from '@/app/components/JobCard';
import FeaturedJobs from '@/app/components/FeaturedJobs';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Internship Listings in India — Refreshed Daily',
  description:
    'Browse the latest internships in software, AI/ML, and data roles from companies in India. Updated daily.',
  alternates: {
    canonical: `${BASE_URL}/internships`,
  },
};

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
  };
}) {
  const search = searchParams.search?.trim() || '';

  const [jobs, featured] = await Promise.all([
    getJobs({ search, type: 'internship', sort: 'ranked' }),
    search ? Promise.resolve([]) : getFeaturedJobs({ type: 'internship' }),
  ]);

  // Card links point at the contextual /internships/[slug] URL; that page
  // canonicalizes back to /jobs/[slug] (see app/internships/[slug]/page.tsx)
  // so this hub still passes SEO value to a single canonical destination
  // per job rather than creating duplicate-content pages.
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
          Internships in India
        </h1>

        <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Internship-only view of our job feed, aggregated from multiple platforms and refreshed daily.{' '}
          <Link href="/jobs" className="underline">
            See all jobs
          </Link>
        </p>

        <form method="GET" action="/internships" className="mt-8">
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

            <button type="submit" className="btn btn-primary px-6 py-3 text-sm">
              Search
            </button>

            {search && (
              <Link href="/internships" className="btn px-6 py-3 text-sm">
                Clear
              </Link>
            )}
          </div>

          {search && (
            <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {jobs.length} result{jobs.length !== 1 ? 's' : ''} found for "{search}"
            </p>
          )}
        </form>

        <AdSlot slot="3995254749" format="auto" className="mt-10" />

        <FeaturedJobs jobs={featured} basePath="/internships" />

        {jobs.length > 0 ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} basePath="/internships" />
            ))}
          </div>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
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

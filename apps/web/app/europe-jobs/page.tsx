import type { Metadata } from 'next';
import Link from 'next/link';

import { jobSlug } from '@/lib/slug';
import {
  getJobs,
  BASE_URL,
} from '@/lib/jobs';

import JobCard from '@/app/components/JobCard';
import SponsoredCard from '@/app/components/SponsoredCard';

export const dynamic = 'force-dynamic';

const JOBS_PER_PAGE = 12;

export const metadata: Metadata = {
  title: 'Europe Jobs — UK, Germany, Netherlands & Remote-for-Europe | InternFlow',
  description:
    'Full-time, contract, and part-time roles based in Europe or open to remote applicants based in Europe, sourced from Jobicy, Arbeitnow, Remotive, We Work Remotely, and Remote OK and refreshed daily.',
  alternates: {
    canonical: `${BASE_URL}/europe-jobs`,
  },
};

function Pagination({
  currentPage,
  totalPages,
  search,
}: {
  currentPage: number;
  totalPages: number;
  search: string;
}) {
  const getPageUrl = (page: number) => {
    const params = new URLSearchParams();

    if (search) {
      params.set('search', search);
    }

    if (page > 1) {
      params.set('page', String(page));
    }

    return `/europe-jobs${
      params.toString() ? `?${params.toString()}` : ''
    }`;
  };

  if (totalPages <= 1) {
    return null;
  }

  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));

  const endPage = Math.min(totalPages, startPage + maxVisible - 1);

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i += 1) {
    pages.push(i);
  }

  return (
    <nav
      className="mt-12 flex flex-wrap justify-center gap-2 px-4"
      aria-label="Pagination"
    >
      {currentPage > 1 && (
        <Link
          href={getPageUrl(currentPage - 1)}
          className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation"
          aria-label="Previous page"
        >
          ←
        </Link>
      )}

      {startPage > 1 && (
        <>
          <Link href={getPageUrl(1)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation">
            1
          </Link>
          {startPage > 2 && <span className="flex items-center px-2">…</span>}
        </>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={getPageUrl(page)}
          className={`btn min-w-[44px] px-3 py-2 text-sm touch-manipulation ${
            page === currentPage ? 'btn-primary' : ''
          }`}
          aria-current={page === currentPage ? 'page' : undefined}
        >
          {page}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && <span className="flex items-center px-2">…</span>}
          <Link href={getPageUrl(totalPages)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation">
            {totalPages}
          </Link>
        </>
      )}

      {currentPage < totalPages && (
        <Link
          href={getPageUrl(currentPage + 1)}
          className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation"
          aria-label="Next page"
        >
          →
        </Link>
      )}
    </nav>
  );
}

export default async function EuropeJobsPage({
  searchParams,
}: {
  searchParams: { search?: string; page?: string };
}) {
  const search = searchParams.search?.trim() || '';

  const parsedPage = Number.parseInt(searchParams.page || '1', 10);
  const requestedPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;

  // country: 'Europe' matches what scrapers/europe_*.py tag every job
  // they collect with (see europe_common.py). Unlike Japan, there's no
  // separate internship-only Europe scraper — types are mixed here.
  const allJobs = await getJobs({
    search,
    country: 'Europe',
    sort: 'ranked',
  });

  const totalJobs = allJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = Math.min(startIndex + JOBS_PER_PAGE, totalJobs);
  const jobs = allJobs.slice(startIndex, endIndex);

  // Europe-sourced jobs are always is_remote=true (see REMOTE_SOURCES in
  // the crawler's normalizer.py), so their one true canonical URL is
  // always under /remote-jobs/{slug} — link there directly rather than
  // inventing a second URL for the same job.
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, index) => ({
      '@type': 'ListItem',
      position: startIndex + index + 1,
      url: `${BASE_URL}/remote-jobs/${jobSlug(job)}`,
    })),
  };

  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
        />

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">// europe jobs</p>

        <h1 className="display mt-2 text-2xl sm:text-3xl font-medium">
          Europe Jobs — UK, Germany, Netherlands & Remote-for-Europe
        </h1>

        <p className="mt-2 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
          Roles based in Europe or open to remote applicants based in Europe, aggregated from
          Jobicy, Arbeitnow, Remotive, We Work Remotely, and Remote OK, refreshed daily.{' '}
          <Link href="/jobs" className="underline">
            See all jobs
          </Link>
        </p>

        <form method="GET" action="/europe-jobs" className="mt-6 sm:mt-8">
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search title, company, skills..."
              className="w-full flex-1 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-sm"
              style={{
                background: 'var(--surface)',
                borderColor: 'var(--border)',
                color: 'var(--ink)',
              }}
            />

            <div className="flex gap-2 sm:gap-3">
              <button
                type="submit"
                className="btn btn-primary flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation"
              >
                Search
              </button>

              {search && (
                <Link
                  href="/europe-jobs"
                  className="btn flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation"
                >
                  Clear
                </Link>
              )}
            </div>
          </div>

          {search && (
            <p className="mt-3 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
              {totalJobs} result{totalJobs !== 1 ? 's' : ''} found for &quot;{search}&quot;
            </p>
          )}
        </form>

        {jobs.length > 0 ? (
          <>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, index) => (
                <div key={job.id} className="contents">
                  <JobCard job={job} basePath="/remote-jobs" />
                  {(index + 1) % 6 === 0 && <SponsoredCard />}
                </div>
              ))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} search={search} />
          </>
        ) : (
          <div className="mt-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {search
                ? `No Europe jobs found for "${search}".`
                : 'No Europe jobs are available right now. Please check again later.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

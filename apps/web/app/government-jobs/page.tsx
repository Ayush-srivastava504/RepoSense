import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

import { jobSlug } from '@/lib/slug';
import {
  getJobs,
  getFeaturedJobs,
  BASE_URL,
} from '@/lib/jobs';

import JobCard from '@/app/components/JobCard';
import FeaturedJobs from '@/app/components/FeaturedJobs';
import SponsoredCard from '@/app/components/SponsoredCard';

const JOBS_PER_PAGE = 12;

export const metadata: Metadata = {
  title: 'Government Jobs — Sarkari Naukri Notifications | InternFlow',
  description:
    'Latest government job notifications from Employment News and FreeJobAlert — department, post, vacancies, and direct-apply links. Refreshed daily.',
  alternates: {
    canonical: `${BASE_URL}/government-jobs`,
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

    return `/government-jobs${
      params.toString()
        ? `?${params.toString()}`
        : ''
    }`;
  };

  if (totalPages <= 1) {
    return null;
  }

  const pages: number[] = [];
  const maxVisible = 5;

  let startPage = Math.max(
    1,
    currentPage - Math.floor(maxVisible / 2),
  );

  const endPage = Math.min(
    totalPages,
    startPage + maxVisible - 1,
  );

  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(
      1,
      endPage - maxVisible + 1,
    );
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
          <Link
            href={getPageUrl(1)}
            className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation"
          >
            1
          </Link>

          {startPage > 2 && (
            <span className="flex items-center px-2">
              …
            </span>
          )}
        </>
      )}

      {pages.map((page) => (
        <Link
          key={page}
          href={getPageUrl(page)}
          className={`btn min-w-[44px] px-3 py-2 text-sm touch-manipulation ${
            page === currentPage
              ? 'btn-primary'
              : ''
          }`}
          aria-current={
            page === currentPage
              ? 'page'
              : undefined
          }
        >
          {page}
        </Link>
      ))}

      {endPage < totalPages && (
        <>
          {endPage < totalPages - 1 && (
            <span className="flex items-center px-2">
              …
            </span>
          )}

          <Link
            href={getPageUrl(totalPages)}
            className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation"
          >
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

export default async function GovernmentJobsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    page?: string;
  };
}) {
  const search =
    searchParams.search?.trim() || '';

  const parsedPage = Number.parseInt(
    searchParams.page || '1',
    10,
  );

  const requestedPage =
    Number.isNaN(parsedPage) || parsedPage < 1
      ? 1
      : parsedPage;

  const [allJobs, featured] = await Promise.all([
    getJobs({
      search,
      category: 'government',
      sort: 'ranked',
    }),
    search
      ? Promise.resolve([])
      : getFeaturedJobs({
          category: 'government',
        }),
  ]);

  const totalJobs = allJobs.length;

  const totalPages = Math.max(
    1,
    Math.ceil(totalJobs / JOBS_PER_PAGE),
  );

  const currentPage = Math.min(
    requestedPage,
    totalPages,
  );

  const startIndex =
    (currentPage - 1) * JOBS_PER_PAGE;

  const endIndex = Math.min(
    startIndex + JOBS_PER_PAGE,
    totalJobs,
  );

  const jobs = allJobs.slice(
    startIndex,
    endIndex,
  );

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map(
      (job, index) => ({
        '@type': 'ListItem',
        position: startIndex + index + 1,
        url: `${BASE_URL}/government-jobs/${jobSlug(job)}`,
      }),
    ),
  };

  return (
    <div className="min-h-screen">
      <Script
        id="government-jobs-in-page-push"
        strategy="afterInteractive"
      >
        {`
          (function(s) {
            s.dataset.zone = '11238200';
            s.src = 'https://nap5k.com/tag.min.js';
          })(
            [document.documentElement, document.body]
              .filter(Boolean)
              .pop()
              .appendChild(document.createElement('script'))
          );
        `}
      </Script>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListSchema),
          }}
        />

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">
          // government jobs
        </p>

        <h1 className="display mt-2 text-2xl sm:text-3xl font-medium">
          Government Jobs in India
        </h1>

        <p
          className="mt-2 text-xs sm:text-sm"
          style={{
            color: 'var(--ink-soft)',
          }}
        >
          Sarkari naukri notifications aggregated from
          Employment News and FreeJobAlert, refreshed daily,
          with direct-apply links to the notifying authority
          where available.{' '}

          <Link
            href="/jobs"
            className="underline"
          >
            See all jobs
          </Link>
        </p>

        <form
          method="GET"
          action="/government-jobs"
          className="mt-6 sm:mt-8"
        >
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
            <input
              type="text"
              name="search"
              defaultValue={search}
              placeholder="Search title, company, skills, location..."
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
                  href="/government-jobs"
                  className="btn flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation"
                >
                  Clear
                </Link>
              )}
            </div>
          </div>

          {search && (
            <p
              className="mt-3 text-xs sm:text-sm"
              style={{
                color: 'var(--ink-soft)',
              }}
            >
              {totalJobs} result
              {totalJobs !== 1 ? 's' : ''}{' '}
              found for &quot;{search}&quot;
            </p>
          )}
        </form>

        <FeaturedJobs
          jobs={featured}
          basePath="/government-jobs"
        />

        {jobs.length > 0 ? (
          <>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, index) => (
                <div
                  key={job.id}
                  className="contents"
                >
                  <JobCard
                    job={job}
                    basePath="/government-jobs"
                  />

                  {(index + 1) % 6 === 0 && (
                    <SponsoredCard />
                  )}
                </div>
              ))}
            </div>

            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              search={search}
            />
          </>
        ) : (
          <div className="mt-16 text-center">
            <p
              className="text-sm"
              style={{
                color: 'var(--muted)',
              }}
            >
              {search
                ? `No government jobs found for "${search}".`
                : 'No government jobs are available right now. Please check again later.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}


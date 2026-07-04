import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { jobSlug } from '@/lib/slug';
import { getJobs, getFeaturedJobs, BASE_URL } from '@/lib/jobs';
import JobCard from '@/app/components/JobCard';
import FeaturedJobs from '@/app/components/FeaturedJobs';

export const dynamic = 'force-dynamic';

const MONETAG_DIRECT_LINK = 'https://omg10.com/4/11238266';
const JOBS_PER_PAGE = 12;

export const metadata: Metadata = {
  title: 'Internship Listings in India — Refreshed Daily',
  description:
    'Browse the latest internships in software, AI/ML, and data roles from companies in India. Updated daily.',
  alternates: {
    canonical: `${BASE_URL}/internships`,
  },
};

function SponsoredCard() {
  return (
    <a
      href={MONETAG_DIRECT_LINK}
      target="_blank"
      rel="noopener noreferrer sponsored"
      className="panel flex h-full flex-col p-4 sm:p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between">
        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">// sponsored</p>
        <span className="chip chip-muted text-[10px] sm:text-[11px]">AD</span>
      </div>

      <h2
        className="display mt-3 sm:mt-4 text-base sm:text-lg font-medium leading-snug"
        style={{ color: 'var(--ink)' }}
      >
        Sponsored Opportunity
      </h2>

      <p
        className="mt-1 text-xs sm:text-sm"
        style={{ color: 'var(--ink-soft)' }}
      >
        InternFlow Partner
      </p>

      <p
        className="mt-3 sm:mt-4 flex-1 text-xs sm:text-sm leading-6 sm:leading-7"
        style={{ color: 'var(--ink-soft)' }}
      >
        Explore a sponsored offer selected for InternFlow visitors.
      </p>

      <span className="mt-4 sm:mt-5 text-xs sm:text-sm font-medium">
        View Sponsored Offer →
      </span>
    </a>
  );
}

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
    if (search) params.set('search', search);
    if (page > 1) params.set('page', String(page));
    return `/internships${params.toString() ? `?${params.toString()}` : ''}`;
  };

  if (totalPages <= 1) return null;

  const pages = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav className="mt-12 flex flex-wrap justify-center gap-2 px-4" aria-label="Pagination">
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

export default async function InternshipsPage({
  searchParams,
}: {
  searchParams: {
    search?: string;
    page?: string;
  };
}) {
  const search = searchParams.search?.trim() || '';
  const currentPage = Math.max(1, parseInt(searchParams.page || '1'));
  
  const [allJobs, featured] = await Promise.all([
    getJobs({
      search,
      type: 'internship',
      sort: 'ranked',
    }),
    search
      ? Promise.resolve([])
      : getFeaturedJobs({
          type: 'internship',
        }),
  ]);

  const totalJobs = allJobs.length;
  const totalPages = Math.ceil(totalJobs / JOBS_PER_PAGE);
  const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
  const endIndex = Math.min(startIndex + JOBS_PER_PAGE, totalJobs);
  const jobs = allJobs.slice(startIndex, endIndex);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: jobs.map((job, index) => ({
      '@type': 'ListItem',
      position: (currentPage - 1) * JOBS_PER_PAGE + index + 1,
      url: `${BASE_URL}/jobs/${jobSlug(job)}`,
    })),
  };

  return (
    <div className="min-h-screen">
      {/* Monetag In-Page Push */}
      <Script
        id="internships-in-page-push"
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

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">// internships</p>

        <h1 className="display mt-2 text-2xl sm:text-3xl font-medium">
          Internships in India
        </h1>

        <p
          className="mt-2 text-xs sm:text-sm"
          style={{ color: 'var(--ink-soft)' }}
        >
          Internship-only view of our job feed, aggregated from multiple
          platforms and refreshed daily.{' '}
          <Link href="/jobs" className="underline">
            See all jobs
          </Link>
        </p>

        <form method="GET" action="/internships" className="mt-6 sm:mt-8">
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
                  href="/internships"
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
              style={{ color: 'var(--ink-soft)' }}
            >
              {totalJobs} result{totalJobs !== 1 ? 's' : ''} found for &quot;{search}&quot;
            </p>
          )}
        </form>

        <FeaturedJobs jobs={featured} basePath="/internships" />

        {jobs.length > 0 ? (
          <>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, index) => (
                <div key={job.id} className="contents">
                  <JobCard job={job} basePath="/internships" />
                  {(startIndex + index + 1) % (JOBS_PER_PAGE * 2) === 0 && (
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
              style={{ color: 'var(--muted)' }}
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
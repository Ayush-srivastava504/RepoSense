// Module: app/japan-jobs/page.tsx
// Defines component(s)/export(s): JOBS_PER_PAGE, TypeTabs, Pagination, JapanJobsPage
// Defines function(s): parseType, generateMetadata
// Defines type(s): JapanType

import type { Metadata } from 'next';
import Link from 'next/link';
import { jobSlug } from '@/lib/slug';
import { getJobs, BASE_URL, } from '@/lib/jobs';
import JobCard from '@/app/components/JobCard';
import SponsoredCard from '@/app/components/SponsoredCard';
const JOBS_PER_PAGE = 12;
type JapanType = 'job' | 'internship';
function parseType(raw?: string): JapanType {
    return raw === 'internship' ? 'internship' : 'job';
}
export async function generateMetadata({ searchParams, }: {
    searchParams: {
        type?: string;
    };
}): Promise<Metadata> {
    const type = parseType(searchParams.type);
    if (type === 'internship') {
        return {
            title: 'Japan Internships — Tokyo, Osaka & Remote-for-Japan',
            description: 'Internships based in Japan or open to remote applicants based in Japan, sourced from Himalayas and Remote OK and refreshed daily.',
            alternates: {
                canonical: `${BASE_URL}/japan-jobs?type=internship`,
            },
        };
    }
    return {
        title: 'Japan Jobs — Tokyo, Osaka & Remote-for-Japan',
        description: 'Full-time, contract, and part-time roles based in Japan or open to remote applicants based in Japan, sourced from Himalayas and Remote OK and refreshed daily.',
        alternates: {
            canonical: `${BASE_URL}/japan-jobs`,
        },
    };
}
function TypeTabs({ type, search }: {
    type: JapanType;
    search: string;
}) {
    const getTabUrl = (t: JapanType) => {
        const params = new URLSearchParams();
        if (search)
            params.set('search', search);
        if (t === 'internship')
            params.set('type', 'internship');
        const qs = params.toString();
        return `/japan-jobs${qs ? `?${qs}` : ''}`;
    };
    return (<div className="mt-6 inline-flex flex-wrap gap-1 rounded-lg border p-1 text-xs sm:text-sm" style={{ borderColor: 'var(--border)' }} role="tablist" aria-label="Japan listing type">
      <Link href={getTabUrl('job')} role="tab" aria-selected={type === 'job'} className={`rounded-md px-3 sm:px-4 py-2 touch-manipulation ${type === 'job' ? 'btn-primary' : ''}`}>
        Full-time jobs
      </Link>
      <Link href={getTabUrl('internship')} role="tab" aria-selected={type === 'internship'} className={`rounded-md px-3 sm:px-4 py-2 touch-manipulation ${type === 'internship' ? 'btn-primary' : ''}`}>
        Internships
      </Link>
    </div>);
}
function Pagination({ currentPage, totalPages, search, type, }: {
    currentPage: number;
    totalPages: number;
    search: string;
    type: JapanType;
}) {
    const getPageUrl = (page: number) => {
        const params = new URLSearchParams();
        if (search) {
            params.set('search', search);
        }
        if (type === 'internship') {
            params.set('type', 'internship');
        }
        if (page > 1) {
            params.set('page', String(page));
        }
        return `/japan-jobs${params.toString() ? `?${params.toString()}` : ''}`;
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
    return (<nav className="mt-12 flex flex-wrap justify-center gap-2 px-4" aria-label="Pagination">
      {currentPage > 1 && (<Link href={getPageUrl(currentPage - 1)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Previous page">
          ←
        </Link>)}

      {startPage > 1 && (<>
          <Link href={getPageUrl(1)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation">
            1
          </Link>
          {startPage > 2 && <span className="flex items-center px-2">…</span>}
        </>)}

      {pages.map((page) => (<Link key={page} href={getPageUrl(page)} className={`btn min-w-[44px] px-3 py-2 text-sm touch-manipulation ${page === currentPage ? 'btn-primary' : ''}`} aria-current={page === currentPage ? 'page' : undefined}>
          {page}
        </Link>))}

      {endPage < totalPages && (<>
          {endPage < totalPages - 1 && <span className="flex items-center px-2">…</span>}
          <Link href={getPageUrl(totalPages)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation">
            {totalPages}
          </Link>
        </>)}

      {currentPage < totalPages && (<Link href={getPageUrl(currentPage + 1)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Next page">
          →
        </Link>)}
    </nav>);
}
export default async function JapanJobsPage({ searchParams, }: {
    searchParams: {
        search?: string;
        page?: string;
        type?: string;
    };
}) {
    const search = searchParams.search?.trim() || '';
    const type = parseType(searchParams.type);
    const parsedPage = Number.parseInt(searchParams.page || '1', 10);
    const requestedPage = Number.isNaN(parsedPage) || parsedPage < 1 ? 1 : parsedPage;
    const allJobs = await getJobs({
        search,
        country: 'Japan',
        ...(type === 'internship' ? { type: 'internship' } : {}),
        sort: 'ranked',
    });
    const totalJobs = allJobs.length;
    const totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
    const currentPage = Math.min(requestedPage, totalPages);
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    const endIndex = Math.min(startIndex + JOBS_PER_PAGE, totalJobs);
    const jobs = allJobs.slice(startIndex, endIndex);
    const basePath = type === 'internship' ? '/internships' : '/remote-jobs';
    const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: jobs.map((job, index) => ({
            '@type': 'ListItem',
            position: startIndex + index + 1,
            url: `${BASE_URL}${basePath}/${jobSlug(job)}`,
        })),
    };
    const heading = type === 'internship'
        ? 'Japan Internships — Tokyo, Osaka & Remote-for-Japan'
        : 'Japan Jobs — Tokyo, Osaka & Remote-for-Japan';
    const intro = type === 'internship'
        ? 'Internships based in Japan or open to remote applicants based in Japan, aggregated from Himalayas and Remote OK, refreshed daily.'
        : 'Roles based in Japan or open to remote applicants based in Japan, aggregated from Himalayas and Remote OK, refreshed daily.';
    const emptyMessage = search
        ? `No Japan ${type === 'internship' ? 'internships' : 'jobs'} found for "${search}".`
        : `No Japan ${type === 'internship' ? 'internships' : 'jobs'} are available right now. Please check again later.`;
    return (<div className="min-h-screen">
      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}/>

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">
          // japan {type === 'internship' ? 'internships' : 'jobs'}
        </p>

        <h1 className="display mt-2 text-2xl sm:text-3xl font-medium">{heading}</h1>

        <p className="mt-2 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
          {intro}{' '}
          <Link href="/jobs" className="underline">
            See all jobs
          </Link>
        </p>

        <TypeTabs type={type} search={search}/>

        <form method="GET" action="/japan-jobs" className="mt-6 sm:mt-8">
          {type === 'internship' && <input type="hidden" name="type" value="internship"/>}
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
            <input type="text" name="search" defaultValue={search} placeholder="Search title, company, skills..." className="w-full flex-1 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-sm" style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
        }}/>

            <div className="flex gap-2 sm:gap-3">
              <button type="submit" className="btn btn-primary flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                Search
              </button>

              {search && (<Link href={type === 'internship' ? '/japan-jobs?type=internship' : '/japan-jobs'} className="btn flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                  Clear
                </Link>)}
            </div>
          </div>

          {search && (<p className="mt-3 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
              {totalJobs} result{totalJobs !== 1 ? 's' : ''} found for &quot;{search}&quot;
            </p>)}
        </form>

        {jobs.length > 0 ? (<>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job, index) => (<div key={job.id} className="contents">
                  <JobCard job={job} basePath={basePath}/>
                  {(index + 1) % 6 === 0 && <SponsoredCard />}
                </div>))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} search={search} type={type}/>
          </>) : (<div className="mt-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {emptyMessage}
            </p>
          </div>)}
      </main>
    </div>);
}

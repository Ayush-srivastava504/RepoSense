// Module: app/remote-jobs/page.tsx
// Defines component(s)/export(s): JOBS_PER_PAGE, Pagination, RemoteJobsPage
//
//

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { listPageState } from '@/lib/seo/pagination';
import { listingMetadata } from '@/lib/seo/pageMeta';
import Link from 'next/link';
import { canonicalPathForJob } from '@/lib/slug';
import { getJobs, getJobsPage, getFeaturedJobs, BASE_URL, } from '@/lib/jobs';
import JobCard from '@/app/components/JobCard';
import FeaturedJobs from '@/app/components/FeaturedJobs';
import { RoleFilter, parseGroupFilter } from '@/app/components/JobFilters';
import {  breadcrumbSchema, languageAlternates, safeJsonLd } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import HubExplore from '@/app/components/HubExplore';
import SectionGuide from '@/app/components/SectionGuide';
import { SECTION_GUIDES } from '@/lib/content/sectionGuides';
const JOBS_PER_PAGE = 12;
export async function generateMetadata({ searchParams, }: {
    searchParams: Record<string, string | undefined>;
}): Promise<Metadata> {
    // Purpose: remote roles only (is_remote), open to India, US, UK and worldwide. Matches the on-page <h1>.
    return listingMetadata({
        path: '/remote-jobs',
        title: 'Remote Jobs — India, US, UK & Worldwide, Updated Daily',
        description: 'Remote software, product, data and sales roles from Himalayas, Remote OK, We Work Remotely and Remotive. Updated daily, open to India, US, UK and worldwide.',
        searchParams,
        imageAlt: 'InternFlow — Remote jobs open to India, US, UK and worldwide',
        languages: languageAlternates('/remote-jobs'),
    });
}
function Pagination({ currentPage, totalPages, search, role, }: {
    currentPage: number;
    totalPages: number;
    search: string;
    role: string;
}) {
    const getPageUrl = (page: number) => {
        const params = new URLSearchParams();
        if (search) {
            params.set('search', search);
        }
        if (role !== 'all') {
            params.set('role', role);
        }
        if (page > 1) {
            params.set('page', String(page));
        }
        return `/remote-jobs${params.toString()
            ? `?${params.toString()}`
            : ''}`;
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

          {startPage > 2 && (<span className="flex items-center px-2">
              …
            </span>)}
        </>)}

      {pages.map((page) => (<Link key={page} href={getPageUrl(page)} className={`btn min-w-[44px] px-3 py-2 text-sm touch-manipulation ${page === currentPage
                ? 'btn-primary'
                : ''}`} aria-current={page === currentPage
                ? 'page'
                : undefined}>
          {page}
        </Link>))}

      {endPage < totalPages && (<>
          {endPage < totalPages - 1 && (<span className="flex items-center px-2">
              …
            </span>)}

          <Link href={getPageUrl(totalPages)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation">
            {totalPages}
          </Link>
        </>)}

      {currentPage < totalPages && (<Link href={getPageUrl(currentPage + 1)} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Next page">
          →
        </Link>)}
    </nav>);
}
export default async function RemoteJobsPage({ searchParams, }: {
    searchParams: {
        search?: string;
        page?: string;
        role?: string;
    };
}) {
    const search = searchParams.search?.trim() || '';
    const guideState = listPageState(searchParams);
    const groupFilter = parseGroupFilter(searchParams.role);
    const parsedPage = Number.parseInt(searchParams.page || '1', 10);
    const requestedPage = Number.isNaN(parsedPage) || parsedPage < 1
        ? 1
        : parsedPage;
    const jobsFilterOptions = {
        search,
        category: 'remote' as const,
        sort: 'ranked' as const,
        // A remote government notification belongs on /government-jobs, not here.
        excludeGovernment: true,
        // Remote internships live on /internships (its remote location filter); this page lists jobs only.
        excludeType: 'internship' as const,
        ...(groupFilter !== 'all' ? { job_group: groupFilter } : {}),
    };
    const showFeatured = !search && requestedPage === 1;
    const fetchJobsPage = (page: number) => getJobsPage({
        ...jobsFilterOptions,
        limit: JOBS_PER_PAGE,
        offset: (page - 1) * JOBS_PER_PAGE,
    });
    // Real LIMIT/OFFSET pagination: the old getJobs() call fetched at most 500 rows and sliced them in
    // memory, so totalJobs was capped at 500 and page 43+ of a bigger feed could never be reached.
    const [firstPage, featured, hubJobs] = await Promise.all([
        fetchJobsPage(requestedPage),
        showFeatured
            ? getFeaturedJobs(jobsFilterOptions)
            : Promise.resolve([]),
        // HubExplore only needs a wide sample to rank "companies hiring"; skipped when searching (it is hidden then).
        search
            ? Promise.resolve([])
            : getJobs({ ...jobsFilterOptions, limit: 100 }),
    ]);
    let jobs = firstPage.jobs;
    let totalJobs = firstPage.total;
    let totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
    const currentPage = Math.min(requestedPage, totalPages);
    if (currentPage !== requestedPage) {
        // Past the last page: redirect to the real last page instead of rendering a duplicate of it under a
        // self-canonical ?page=N URL. Temporary (307): the total moves daily.
        const qs = new URLSearchParams();
        for (const [key, value] of Object.entries(searchParams)) {
            if (typeof value === 'string' && value && key !== 'page') qs.set(key, value);
        }
        if (currentPage > 1) qs.set('page', String(currentPage));
        redirect(`/remote-jobs${qs.toString() ? `?${qs.toString()}` : ''}`);
    }
    const startIndex = (currentPage - 1) * JOBS_PER_PAGE;
    const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: jobs.map((job, index) => ({
            '@type': 'ListItem',
            position: startIndex + index + 1,
            url: `${BASE_URL}${canonicalPathForJob(job)}`,
        })),
    };
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Remote Jobs', url: `${BASE_URL}/remote-jobs` },
    ]);
    return (<div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: safeJsonLd(crumbs),
      }}/>
      <Breadcrumbs schema={crumbs}/>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: safeJsonLd(itemListSchema),
        }}/>

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">
          // remote jobs
        </p>

        <h1 className="display mt-2 text-2xl sm:text-3xl font-medium">
          Remote Jobs — India, US, UK & Worldwide
        </h1>
        <p className="mt-1 text-sm italic" style={{ color: 'var(--indigo)' }}>
          {SECTION_GUIDES['remote-jobs'].motto}
        </p>


        <p className="mt-2 text-xs sm:text-sm" style={{
            color: 'var(--ink-soft)',
        }}>
          Remote-first roles aggregated from Himalayas,
          Remote OK, We Work Remotely, and Remotive,
          refreshed daily.{' '}

          <Link href="/jobs" className="underline">
            See all jobs
          </Link>
          {' · '}
          <Link href="/internships" className="underline">
            Internships
          </Link>
        </p>

        <form method="GET" action="/remote-jobs" className="mt-6 sm:mt-8">
          <div className="flex flex-col gap-2 sm:gap-3 sm:flex-row">
            <input type="text" name="search" defaultValue={search} placeholder="Search title, company, skills, location..." className="w-full flex-1 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-base sm:text-sm" style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
        }}/>

            <div className="flex gap-2 sm:gap-3">
              <button type="submit" className="btn btn-primary flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                Search
              </button>

              {search && (<Link href="/remote-jobs" className="btn flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                  Clear
                </Link>)}
            </div>
          </div>

          {search && (<p className="mt-3 text-xs sm:text-sm" style={{
                color: 'var(--ink-soft)',
            }}>
              {totalJobs} result
              {totalJobs !== 1 ? 's' : ''}{' '}
              found for &quot;{search}&quot;
            </p>)}
        </form>

        <div className="mt-4">
          <RoleFilter basePath="/remote-jobs" search={search} group={groupFilter}/>
        </div>

        <FeaturedJobs jobs={featured} basePath="/remote-jobs"/>

        {jobs.length > 0 ? (<>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (<div key={job.id} className="contents">
                  <JobCard job={job} basePath="/remote-jobs"/>

                </div>))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} search={search} role={groupFilter}/>
          </>) : (<div className="mt-16 text-center">
            <p className="text-sm" style={{
                color: 'var(--muted)',
            }}>
              {search
                ? `No remote jobs found for "${search}".`
                : 'No remote jobs are available right now. Please check again later.'}
            </p>
          </div>)}
      
        {!search && <HubExplore currentSection="/remote-jobs" jobs={hubJobs}/>}

        {guideState.page === 1 && !guideState.filtered && <SectionGuide section="remote-jobs"/>}
      </main>
    </div>);
}

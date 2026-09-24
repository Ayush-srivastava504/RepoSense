// Module: app/jobs/page.tsx
// Defines component(s)/export(s): JOBS_PER_PAGE, Pagination, JobsPage

import type { Metadata } from 'next';
import { listPageState, paginatedCanonical, paginatedTitle } from '@/lib/seo/pagination';
import Link from 'next/link';

import { canonicalPathForJob } from '@/lib/slug';
import { getJobsPage, getFeaturedJobs, BASE_URL, } from '@/lib/jobs';
import JobCard from '@/app/components/JobCard';
import FeaturedJobs from '@/app/components/FeaturedJobs';
import JobsSearchTracker from '@/app/components/JobsSearchTracker';
import { parseLocationFilter, parseGroupFilter, parseWorkModeFilter, } from '@/app/components/JobFilters';
import AdvancedJobFilters from '@/app/components/AdvancedJobFilters';
import PopularSkills from '@/app/components/PopularSkills';
import { sortIndiaFirst, isIndiaJob } from '@/lib/jobPriority';
import {  breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import { getJobFacets } from '@/lib/facets';
import { parseAdvancedFilters } from '@/lib/filterJobs';
const JOBS_PER_PAGE = 12;
export async function generateMetadata({ searchParams, }: {
    searchParams: Record<string, string | undefined>;
}): Promise<Metadata> {
    const { page, filtered } = listPageState(searchParams);
    return {
        title: paginatedTitle('Job & Internship Listings — India, Remote & Japan — Refreshed Daily', page),
        description: 'Browse the latest software engineering, sales, and finance jobs and internships from India, remote companies, and Japan. Updated daily, no login required.',
        alternates: {
            canonical: paginatedCanonical(BASE_URL, '/jobs', searchParams),
            // hreflang only for the plain first page; deeper/filtered views are not translated variants.
            ...(page === 1 && !filtered ? { languages: languageAlternates('/jobs') } : {}),
        },
    };
}
function Pagination({ currentPage, totalPages, search, loc, role, extraParams, }: {
    currentPage: number;
    totalPages: number;
    search: string;
    loc: string;
    role: string;
    extraParams?: Record<string, string | undefined>;
}) {
    const getPageUrl = (page: number) => {
        const params = new URLSearchParams();
        if (search) {
            params.set('search', search);
        }
        if (loc !== 'all') {
            params.set('loc', loc);
        }
        if (role !== 'all') {
            params.set('role', role);
        }
        for (const [key, value] of Object.entries(extraParams ?? {})) {
            if (value) params.set(key, value);
        }
        if (page > 1) {
            params.set('page', String(page));
        }
        return `/jobs${params.toString() ? `?${params.toString()}` : ''}`;
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
    return (<nav className="mt-10 sm:mt-12 flex flex-wrap justify-center gap-1.5 sm:gap-2 px-2 sm:px-4" aria-label="Pagination">
      {currentPage > 1 && (<Link href={getPageUrl(currentPage - 1)} className="btn min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm touch-manipulation" aria-label="Previous page">
          ←
        </Link>)}

      {startPage > 1 && (<>
          <Link href={getPageUrl(1)} className="btn min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm touch-manipulation">
            1
          </Link>

          {startPage > 2 && (<span className="flex items-center px-1 sm:px-2 text-xs sm:text-sm">
              …
            </span>)}
        </>)}

      {pages.map((page) => (<Link key={page} href={getPageUrl(page)} className={`btn min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm touch-manipulation ${page === currentPage ? 'btn-primary' : ''}`} aria-current={page === currentPage ? 'page' : undefined}>
          {page}
        </Link>))}

      {endPage < totalPages && (<>
          {endPage < totalPages - 1 && (<span className="flex items-center px-1 sm:px-2 text-xs sm:text-sm">
              …
            </span>)}

          <Link href={getPageUrl(totalPages)} className="btn min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm touch-manipulation">
            {totalPages}
          </Link>
        </>)}

      {currentPage < totalPages && (<Link href={getPageUrl(currentPage + 1)} className="btn min-w-[40px] sm:min-w-[44px] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm touch-manipulation" aria-label="Next page">
          →
        </Link>)}
    </nav>);
}
export default async function JobsPage({ searchParams, }: {
    searchParams: {
        search?: string;
        page?: string;
        loc?: string;
        role?: string;
        mode?: string;
        skills?: string;
        course?: string;
        source?: string;
        batch?: string;
        company?: string;
    };
}) {
    const search = searchParams.search?.trim() || '';
    const locationFilter = parseLocationFilter(searchParams.loc);
    const groupFilter = parseGroupFilter(searchParams.role);
    const workModeFilter = parseWorkModeFilter(searchParams.mode);
    const advancedFilters = parseAdvancedFilters(searchParams);
    const parsedPage = Number.parseInt(searchParams.page || '1', 10);
    const requestedPage = Number.isNaN(parsedPage) || parsedPage < 1
        ? 1
        : parsedPage;
    const jobsFilterOptions = {
        search,
        sort: 'ranked' as const,
        ...(locationFilter === 'remote' ? { category: 'remote' as const } : {}),
        ...(locationFilter === 'japan' ? { country: 'Japan' } : {}),
        ...(groupFilter !== 'all' ? { job_group: groupFilter } : {}),
        ...(workModeFilter !== 'all' ? { work_mode: workModeFilter } : {}),
        // Phase 2 pagination follow-up (PHASE_PLAN.md item 2's leftover
        // note): India filtering/ordering now happens server-side
        // (routes/jobs.py's india_only/india_first) so the list can be
        // paginated with real LIMIT/OFFSET, instead of fetching up to 500
        // jobs and running lib/jobPriority.ts's isIndiaJob()/
        // sortIndiaFirst() over the whole fetched array client-side.
        ...(locationFilter === 'india' ? { indiaOnly: true } : {}),
        ...(locationFilter === 'all' ? { indiaFirst: true } : {}),
    };
    const showFeatured = !search && requestedPage === 1;
    const fetchJobsPage = (page: number) => getJobsPage({
        ...jobsFilterOptions,
        skills: advancedFilters.skills,
        courses: advancedFilters.courses,
        sources: advancedFilters.sources,
        batches: advancedFilters.batches,
        companies: advancedFilters.companies,
        limit: JOBS_PER_PAGE,
        offset: (page - 1) * JOBS_PER_PAGE,
    });
    const [firstPage, fetchedFeatured, facets] = await Promise.all([
        fetchJobsPage(requestedPage),
        showFeatured
            ? getFeaturedJobs(jobsFilterOptions)
            : Promise.resolve([]),
        // Phase 2 (PHASE_PLAN.md item 1): counts come from the backend
        // facets endpoint (full-table aggregation), scoped by
        // location+role+mode+search but deliberately NOT by the advanced
        // filters themselves — so a selected "Skills: React" chip doesn't
        // shrink its own dropdown's option list down to just React.
        getJobFacets(jobsFilterOptions),
    ]);
    let jobs = firstPage.jobs;
    let totalJobs = firstPage.total;
    let totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
    let currentPage = Math.min(requestedPage, totalPages);
    // requestedPage pointed past the last page (a stale bookmark or a
    // hand-edited ?page=), so the offset above landed beyond `total` and
    // came back empty — refetch at the clamped page. Only the
    // out-of-range case pays for a second request; the common case above
    // is a single fetch.
    if (currentPage !== requestedPage) {
        const clamped = await fetchJobsPage(currentPage);
        jobs = clamped.jobs;
        totalJobs = clamped.total;
        totalPages = Math.max(1, Math.ceil(totalJobs / JOBS_PER_PAGE));
    }
    const featured = locationFilter === 'india'
        ? fetchedFeatured.filter(isIndiaJob)
        : locationFilter === 'all'
            ? sortIndiaFirst(fetchedFeatured)
            : fetchedFeatured;
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
        { name: 'Jobs', url: `${BASE_URL}/jobs` },
    ]);
    return (<div className="min-h-screen">
      <JobsSearchTracker search={search} resultCount={totalJobs}/>

      <script type="application/ld+json" dangerouslySetInnerHTML={{
          __html: JSON.stringify(crumbs),
      }}/>
      <Breadcrumbs schema={crumbs}/>

      <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
        <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(itemListSchema),
        }}/>

        <p className="eyebrow eyebrow-accent text-xs sm:text-sm">
          // jobs
        </p>

        <h1 className="display mt-2 flex flex-wrap items-baseline gap-2 text-2xl sm:text-3xl font-medium">
          Jobs in India
          <span className="text-sm font-normal sm:text-base" style={{ color: 'var(--ink-soft)' }}>
            {totalJobs} found
          </span>
        </h1>

        <p className="mt-2 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
          Our full job feed, aggregated from multiple platforms and refreshed
          daily.{' '}

          <Link href="/internships" className="underline">
            See internships only
          </Link>
        </p>

        <form method="GET" action="/jobs" className="mt-6 sm:mt-8">
          {locationFilter !== 'all' && (<input type="hidden" name="loc" value={locationFilter}/>)}
          {groupFilter !== 'all' && (<input type="hidden" name="role" value={groupFilter}/>)}
          {workModeFilter !== 'all' && (<input type="hidden" name="mode" value={workModeFilter}/>)}

          <div className="flex flex-col gap-2 sm:gap-3">
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <input type="text" name="search" defaultValue={search} placeholder="Search title, company, skills, location..." className="w-full flex-1 rounded-lg border px-3 sm:px-4 py-2.5 sm:py-3 text-sm" style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            color: 'var(--ink)',
        }}/>

              <div className="flex gap-2 sm:gap-3">
                <button type="submit" className="btn btn-primary flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                  Search
                </button>

                {search && (<Link href="/jobs" className="btn flex-1 sm:flex-none px-4 sm:px-6 py-2.5 sm:py-3 text-sm touch-manipulation">
                    Clear
                  </Link>)}
              </div>
            </div>
          </div>

          {search && (<p className="mt-3 text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
              {totalJobs} result
              {totalJobs !== 1 ? 's' : ''} found for &quot;
              {search}&quot;
            </p>)}
        </form>

        <AdvancedJobFilters basePath="/jobs" search={search} location={locationFilter} group={groupFilter} mode={workModeFilter} skills={advancedFilters.skills} courses={advancedFilters.courses} sources={advancedFilters.sources} batches={advancedFilters.batches} companies={advancedFilters.companies} facets={facets} resultCount={totalJobs}/>

        <PopularSkills className="mt-3"/>

        <FeaturedJobs jobs={featured} basePath="/jobs"/>

        {jobs.length > 0 ? (<>
            <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
              {jobs.map((job) => (<div key={job.id} className="contents">
                  <JobCard job={job} basePath="/jobs"/>

                </div>))}
            </div>

            <Pagination currentPage={currentPage} totalPages={totalPages} search={search} loc={locationFilter} role={groupFilter} extraParams={{
                mode: workModeFilter !== 'all' ? workModeFilter : undefined,
                skills: searchParams.skills,
                course: searchParams.course,
                source: searchParams.source,
                batch: searchParams.batch,
                company: searchParams.company,
            }}/>
          </>) : (<div className="mt-16 text-center">
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {search
                ? `No jobs found for "${search}".`
                : 'No jobs are available right now. Please check again later.'}
            </p>
          </div>)}

        <section className="mt-16 sm:mt-20 border-t pt-10" style={{ borderColor: 'var(--line)' }}>
          <p className="eyebrow eyebrow-accent text-xs sm:text-sm">// about this page</p>

          <h2 className="display mt-2 text-xl sm:text-2xl font-medium">
            Find High Paying Jobs and Internships in India, Remote, and Japan
          </h2>

          <div className="mt-4 grid gap-6 sm:grid-cols-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            <div>
              <p>
                InternFlow aggregates job and internship listings from dozens of
                company career pages and top job boards every day, so you don&apos;t have
                to check each one yourself. Use the <strong>location filter</strong> to
                switch between opportunities based in India, fully remote jobs, or
                highly sought-after jobs and internships in Japan. Use the <strong>role filter</strong> to
                narrow results down to Software Engineer, AI Engineer, Data Engineer, Sales, Finance, or Other
                positions.
              </p>

              <p className="mt-3">
                Every listing is checked for freshness: newly posted roles are
                ranked first, and listings that have been open for more than
                30 days are automatically de-ranked and eventually retired if
                they&apos;re no longer active. We prioritize high paying jobs and verified remote opportunities, ensuring you spend less time applying to
                jobs that have already closed or do not meet your expectations.
              </p>
            </div>

            <div>
              <p>
                Whether you&apos;re a computer science student looking for a
                software engineering internship, an experienced DevOps engineer exploring remote roles, or a finance
                graduate hunting for your first analyst position, our feed
                pulls from company career pages, remote-first job boards, and
                Japan-focused listings to give you one single platform to search. Pair this with our free ATS resume builder and cover letter templates to maximize your chances of getting hired.
              </p>

              <p className="mt-3">
                Have a listing to report, a company you&apos;d like to see added, or
                general feedback? Email us at{' '}
                <a href="mailto:creatoramplified@gmail.com" className="underline font-medium hover:text-[color:var(--ink)] transition-colors">
                  creatoramplified@gmail.com
                </a>
                .
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>);
}

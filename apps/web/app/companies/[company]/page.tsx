// Module: app/companies/[company]/page.tsx
// Defines component(s)/export(s): CompanyHubPage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs, getJobsPage } from '@/lib/jobs';
import { relatedCompanies } from '@/lib/companyLinks';
import RelatedCompanies from '@/app/components/RelatedCompanies';
import { getCompanies, getCompanyBySlug, getCompanyIntel, getCompanyProfile, companySlug } from '@/lib/companies';
import { companyIsThin } from '@/lib/seo/hubThresholds';
import { truncateDescription, truncateTitleForSerp } from '@/lib/seo/seoMetrics';
import { companyOgImageUrl } from '@/lib/seo/ogImage';
import {  breadcrumbSchema, companyOrganizationSchema, languageAlternates, safeJsonLd } from '@/lib/structuredData';
import JobCard from '@/app/components/JobCard';
import CompanyLogo from '@/app/components/CompanyLogo';
import TrackView from '@/app/components/TrackView';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import CompanyProfilePanel from '@/app/components/CompanyProfilePanel';
import CompanyTopics from '@/app/components/CompanyTopics';

export const dynamicParams = true;

export async function generateStaticParams() {
    try {
        const { top, mass_hire, startup } = await getCompanies(100);
        const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
        return all.map((c) => ({ company: companySlug(c.company) }));
    }
    catch (err) {
        console.error('generateStaticParams failed for companies', err);
        return [];
    }
}

export async function generateMetadata({ params, searchParams, }: {
    params: { company: string };
    searchParams: { page?: string };
}): Promise<Metadata> {
  try {
    return await buildCompanyMetadata(params, searchParams);
  }
  catch (err) {
    console.error('generateMetadata failed for company', params.company, err);
    return { robots: { index: false, follow: true } };
  }
}

async function buildCompanyMetadata(params: { company: string }, searchParams: { page?: string }): Promise<Metadata> {
    const company = await getCompanyBySlug(params.company);
    if (!company)
        return {};
    const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
    const url = `${BASE_URL}/companies/${params.company}${page > 1 ? `?page=${page}` : ''}`;
    const pageSuffix = page > 1 ? ` — Page ${page}` : '';
    const [profile, intel] = await Promise.all([getCompanyProfile(company.company), getCompanyIntel(params.company)]);
    const hasHiringProcess = Boolean(intel?.topics.some((t) => t.topic_key === 'hiring_process'));
    const title = truncateTitleForSerp(`${company.company} Jobs & Internships — ${hasHiringProcess ? 'Openings, Hiring Process' : 'Current Openings'}${pageSuffix}`);
    const overview = intel?.topics.find((t) => t.topic_key === 'overview')?.body;
    const jobsLine = `${company.job_count} active listing${company.job_count === 1 ? '' : 's'} at ${company.company} right now.`;
    const description = truncateDescription(overview ? `${overview} ${jobsLine}${pageSuffix}` : `${jobsLine} Browse jobs and internships, with the skills they ask for. Updated daily on InternFlow.${pageSuffix}`);
    const thin = companyIsThin(company.job_count, Boolean(profile), intel?.topics.length ?? 0);
    return {
        title,
        description,
        ...(thin ? { robots: { index: false, follow: true } } : {}),
        alternates: { canonical: url, languages: page > 1 ? undefined : languageAlternates(`/companies/${params.company}`) },
        openGraph: {
            type: 'website',
            url,
            title,
            description,
            images: [{ url: companyOgImageUrl(params.company), width: 1200, height: 630, alt: `${company.company} on InternFlow` }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [companyOgImageUrl(params.company)],
        },
    };
}

const COMPANY_JOBS_PER_PAGE = 30;

export default async function CompanyHubPage({ params, searchParams, }: {
    params: { company: string };
    searchParams: { page?: string };
}) {
    const company = await getCompanyBySlug(params.company);
    if (!company)
        notFound();

    // Was a flat `limit: 30` with no way to reach anything past it: a mass-hire
    // company (MASS_HIRE_THRESHOLD, routes/companies.py) with 100+ live postings
    // had 70+ jobs with NO internal link anywhere on the site except the sitemap
    // itself -- exactly the "thin internal linking" pattern that leaves real
    // listings sitting at "Discovered - currently not indexed" in GSC. Paginated
    // the same way /jobs already is, so every active job at every company gets
    // a real crawlable link path, not just the first 30.
    const page = Math.max(1, Number.parseInt(searchParams?.page ?? '1', 10) || 1);
    const url = `${BASE_URL}/companies/${params.company}${page > 1 ? `?page=${page}` : ''}`;
    // Page 1 also asks for this company's internships directly: in the single ranked list they can sit
    // past the first 30 rows behind full-time roles, which left them with no link from the company hub.
    // Every secondary source is optional: one failing call must degrade that block, never 500 the page.
    const [jobsRes, profileRes, intelRes, internshipsRes, companiesRes] = await Promise.allSettled([
        getJobsPage({ company: company.company, limit: COMPANY_JOBS_PER_PAGE, offset: (page - 1) * COMPANY_JOBS_PER_PAGE, sort: 'ranked' }),
        getCompanyProfile(company.company),
        getCompanyIntel(params.company),
        page === 1 ? getJobs({ company: company.company, type: 'internship', limit: 12, sort: 'ranked' }) : Promise.resolve([]),
        page === 1 ? getCompanies(60) : Promise.resolve(null),
    ]);
    // Drop malformed rows (null / no id) so one bad job can't crash the whole page.
    const validJob = (j: any) => j && typeof j === 'object' && j.id != null && typeof j.title === 'string' && typeof j.company === 'string';
    const jobsRaw = jobsRes.status === 'fulfilled' ? jobsRes.value : { jobs: [], total: 0 };
    const jobs = (Array.isArray(jobsRaw.jobs) ? jobsRaw.jobs : []).filter(validJob);
    const total = Number.isFinite(jobsRaw.total) ? jobsRaw.total : jobs.length;
    const profile = profileRes.status === 'fulfilled' ? profileRes.value : null;
    const intel = intelRes.status === 'fulfilled' ? intelRes.value : null;
    const internshipsFirst = (internshipsRes.status === 'fulfilled' && Array.isArray(internshipsRes.value) ? internshipsRes.value : []).filter(validJob);
    const companiesData = companiesRes.status === 'fulfilled' ? companiesRes.value : null;
    const topics = intel?.topics ?? [];
    const totalPages = Math.max(1, Math.ceil(total / COMPANY_JOBS_PER_PAGE));
    // ?page=N past the last page is a real 404, not an empty indexable page.
    if (page > totalPages)
        notFound();
    const internships = page === 1 ? internshipsFirst : jobs.filter((j) => j.type === 'internship');
    let related: ReturnType<typeof relatedCompanies> = [];
    try {
        related = companiesData
            ? relatedCompanies([...companiesData.top.companies, ...companiesData.mass_hire.companies, ...companiesData.startup.companies], company)
            : [];
    }
    catch (err) {
        console.error('relatedCompanies failed', err);
    }
    const fullTimeJobs = jobs.filter((j) => j.type !== 'internship');
    const keywords = Array.from(new Set(jobs.flatMap((j) => (Array.isArray(j.enriched_keywords) ? j.enriched_keywords : [])))).filter((k): k is string => typeof k === 'string' && k.length > 0).slice(0, 12);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Companies', url: `${BASE_URL}/companies` },
        { name: company.company, url },
    ]);

    const orgSchema = companyOrganizationSchema({
        name: company.company,
        pageUrl: `${BASE_URL}/companies/${params.company}`,
        officialDomain: company.apply_domain,
        isOfficialDomain: company.is_official_domain,
        description: intel?.topics.find((t) => t.topic_key === 'overview')?.body ?? profile?.overview ?? null,
    });

    return (<main className="w-full">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(orgSchema) }}/>
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="company_hub_view" params={{ company: company.company }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <div className="flex items-center gap-4">
          <CompanyLogo company={company.company} logoDomain={company.logo_domain} size={56}/>
          <div>
            <p className="eyebrow eyebrow-accent">// {company.tier === 'top' ? 'top company' : company.tier === 'mass_hire' ? 'mass hiring' : 'startup'}</p>
            <h1 className="display mt-1 text-3xl font-medium sm:text-4xl">{company.company} <span className="text-2xl font-normal sm:text-3xl" style={{ color: 'var(--ink-soft)' }}>jobs &amp; internships</span></h1>
          </div>
        </div>

        {page === 1 && topics.length === 0 && (
        <div className="mt-4 max-w-3xl leading-relaxed text-sm sm:text-base space-y-3" style={{ color: 'var(--ink-soft)' }}>
          <p>
            {company.job_count} active listing{company.job_count === 1 ? '' : 's'} at {company.company} right now
            {company.sample_location ? `, based around ${company.sample_location}` : ''} — pulled directly from the {company.company} career page and top job boards.
          </p>
          <p>
            If you are preparing to apply for a role at {company.company}, make sure your resume matches the required skills. 
            Review the live job openings and internships below, note the frequently mentioned keywords, and use our free ATS resume checker to optimize your application before submitting it.
          </p>
        </div>
        )}

        {page === 1 && topics.length > 0 && (<p className="mt-4 max-w-3xl text-sm sm:text-base" style={{ color: 'var(--ink-soft)' }}>
            {total} active listing{total === 1 ? '' : 's'} at {company.company} right now, with what the company says about working there below.
          </p>)}

        {keywords.length > 0 && (<div className="mt-5 flex flex-wrap gap-2">
            {keywords.map((kw) => (<Link key={kw} href={`/jobs?search=${encodeURIComponent(kw)}`} className="chip chip-muted text-xs">
                {kw}
              </Link>))}
          </div>)}

        {/* Profile + topics only on page 1: ?page=N self-canonicalises, so repeating them there is duplicate content. */}
        {page === 1 && (<>
          <CompanyProfilePanel profile={profile} hideOverview={topics.some((t) => t.topic_key === 'overview')}/>

          <CompanyTopics topics={topics}/>
        </>)}

        {fullTimeJobs.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">Open roles at {company.company}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fullTimeJobs.map((job) => (<JobCard key={job.id} job={job} basePath={job.is_government ? '/government-jobs' : job.is_remote ? '/remote-jobs' : '/jobs'}/>))}
            </div>
          </section>)}

        {internships.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">Internships at {company.company}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {internships.map((job) => (<JobCard key={job.id} job={job} basePath="/internships"/>))}
            </div>
          </section>)}

        {jobs.length === 0 && (<p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            No live listings at {company.company} right now — check back after the next crawl, or{' '}
            <Link href="/companies" className="underline">browse other companies</Link>.
          </p>)}

        {totalPages > 1 && (<nav className="mt-8 flex flex-wrap justify-center gap-1.5 sm:gap-2" aria-label="Pagination">
            {page > 1 && (<Link href={`/companies/${params.company}${page - 1 > 1 ? `?page=${page - 1}` : ''}`} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Previous page">
                ←
              </Link>)}
            <span className="flex items-center px-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (<Link href={`/companies/${params.company}?page=${page + 1}`} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Next page">
                →
              </Link>)}
          </nav>)}

        <RelatedCompanies companies={related}/>

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Get ready to apply</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <Link href="/tools/ats-resume-checker" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Check your resume
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/leetcode" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Practice interview questions
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/internships" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Browse all internships
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/companies" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Browse other companies
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>);
}

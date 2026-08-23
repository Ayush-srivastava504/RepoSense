// Module: app/companies/[company]/page.tsx
// Defines component(s)/export(s): CompanyHubPage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs } from '@/lib/jobs';
import { getCompanies, getCompanyBySlug, companySlug } from '@/lib/companies';
import { breadcrumbSchema } from '@/lib/structuredData';
import JobCard from '@/app/components/JobCard';
import CompanyLogo from '@/app/components/CompanyLogo';
import TrackView from '@/app/components/TrackView';

export const dynamicParams = true;

export async function generateStaticParams() {
    const { top, mass_hire, startup } = await getCompanies(100);
    const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
    return all.map((c) => ({ company: companySlug(c.company) }));
}

export async function generateMetadata({ params, }: {
    params: { company: string };
}): Promise<Metadata> {
    const company = await getCompanyBySlug(params.company);
    if (!company)
        return {};
    const url = `${BASE_URL}/companies/${params.company}`;
    const title = `${company.company} Jobs & Internships — Openings, Hiring Process`;
    const description = `${company.job_count} active listing${company.job_count === 1 ? '' : 's'} at ${company.company} right now, plus the skills they hire for. Updated daily on InternFlow.`;
    return {
        title,
        description,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            url,
            title,
            description,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: `${company.company} on InternFlow` }],
        },
    };
}

export default async function CompanyHubPage({ params, }: {
    params: { company: string };
}) {
    const company = await getCompanyBySlug(params.company);
    if (!company)
        notFound();

    const url = `${BASE_URL}/companies/${params.company}`;
    const jobs = await getJobs({ company: company.company, limit: 30, sort: 'ranked' });
    const internships = jobs.filter((j) => j.type === 'internship');
    const fullTimeJobs = jobs.filter((j) => j.type !== 'internship');
    const keywords = Array.from(new Set(jobs.flatMap((j) => j.enriched_keywords ?? []))).slice(0, 12);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Companies', url: `${BASE_URL}/companies` },
        { name: company.company, url },
    ]);

    return (<main className="w-full">
      <Script id="company-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <TrackView event="company_hub_view" params={{ company: company.company }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <nav className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href="/companies">Companies</Link> <span aria-hidden="true">/</span> {company.company}
        </nav>

        <div className="flex items-center gap-4">
          <CompanyLogo company={company.company} logoDomain={company.logo_domain} size={56}/>
          <div>
            <p className="eyebrow eyebrow-accent">// {company.tier === 'top' ? 'top company' : company.tier === 'mass_hire' ? 'mass hiring' : 'startup'}</p>
            <h1 className="display mt-1 text-3xl font-medium sm:text-4xl">{company.company}</h1>
          </div>
        </div>

        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {company.job_count} active listing{company.job_count === 1 ? '' : 's'} at {company.company} right now
          {company.sample_location ? `, based around ${company.sample_location}` : ''} — pulled from the same feed
          as InternFlow's Jobs and Internships pages.
        </p>

        {keywords.length > 0 && (<div className="mt-5 flex flex-wrap gap-2">
            {keywords.map((kw) => (<Link key={kw} href={`/jobs?search=${encodeURIComponent(kw)}`} className="chip chip-muted text-xs">
                {kw}
              </Link>))}
          </div>)}

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

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Get ready to apply</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
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

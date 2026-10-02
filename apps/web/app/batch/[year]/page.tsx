// Module: app/batch/[year]/page.tsx
// Defines component(s)/export(s): BatchHubPage
// Defines function(s): generateStaticParams, generateMetadata
//
// PHASE_PLAN.md Phase 3 item 1 — mirrors app/skills/[skill]/page.tsx's
// structure (hero, live job/internship grids, companies hiring, FAQ,
// related links, breadcrumbs) with the job filter swapped from skill to
// passout-year batch (getJobs({ batches: [year] }), routes/jobs.py's
// existing Phase 2 multi-select param). See PHASE_PLAN.md Phase 3 item 2
// for the below-threshold noindex gate applied here (BATCH_MIN_JOBS).

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs } from '@/lib/jobs';
import { canonicalPathForJob } from '@/lib/slug';
import { companySlug } from '@/lib/companies';
import { BATCHES, getBatchByYear, getRelatedBatches } from '@/app/batch/data';
import {  breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import { BATCH_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';
import JobCard from '@/app/components/JobCard';
import TrackView from '@/app/components/TrackView';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import HubExplore from '@/app/components/HubExplore';
import { topCompaniesFromJobs } from '@/lib/hubLinks';
import EntityNotes from '@/app/components/EntityNotes';
import { BATCH_NOTES } from '@/lib/content/entityNotes';

export const dynamicParams = false;

export function generateStaticParams() {
    return BATCHES.map((b) => ({ year: b.year }));
}

async function getBatchJobs(year: string) {
    const [jobs, internships] = await Promise.all([
        getJobs({ batches: [year], type: undefined, limit: 9, sort: 'ranked' }),
        getJobs({ batches: [year], type: 'internship', limit: 6, sort: 'ranked' }),
    ]);
    return { jobs, internships };
}

export async function generateMetadata({ params, }: {
    params: { year: string };
}): Promise<Metadata> {
    const batchDef = getBatchByYear(params.year);
    if (!batchDef)
        return {};
    const url = `${BASE_URL}/batch/${batchDef.year}`;
    // Deduped against the page component's identical getJobs() calls by
    // Next.js's fetch cache within one request — see the same note on
    // app/skills/[skill]/page.tsx's generateMetadata.
    const { jobs, internships } = await getBatchJobs(batchDef.year);
    return {
        title: batchDef.metaTitle,
        description: batchDef.metaDescription,
        alternates: { canonical: url, languages: languageAlternates(`/batch/${batchDef.year}`) },
        ...(belowHubThreshold(jobs.length + internships.length, BATCH_MIN_JOBS)
            ? { robots: { index: false, follow: true } }
            : {}),
        openGraph: {
            type: 'website',
            url,
            title: batchDef.metaTitle,
            description: batchDef.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: `${batchDef.year} batch jobs` }],
        },
        twitter: {
            card: 'summary_large_image',
            title: batchDef.metaTitle,
            description: batchDef.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}

export default async function BatchHubPage({ params, }: {
    params: { year: string };
}) {
    const batchDef = getBatchByYear(params.year);
    if (!batchDef)
        notFound();

    const url = `${BASE_URL}/batch/${batchDef.year}`;
    const { jobs, internships } = await getBatchJobs(batchDef.year);
    const related = getRelatedBatches(batchDef);
    const companies = topCompaniesFromJobs([...jobs, ...internships], 8).map((c) => c.name);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Batch', url: `${BASE_URL}/batch` },
        { name: `${batchDef.year} batch`, url },
    ]);

    return (<main className="w-full">
      <Script id="batch-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="batch_hub_view" params={{ batch: batchDef.year }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <p className="eyebrow eyebrow-accent">// {batchDef.year} passout batch</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{batchDef.year} Batch Jobs &amp; Internships</h1>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{batchDef.heroDescription}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/jobs?batch=${encodeURIComponent(batchDef.year)}`} className="btn btn-primary w-full text-center sm:w-auto">
            Browse all {batchDef.year} batch jobs
          </Link>
          <Link href="/tools/ats-resume-checker" className="btn w-full text-center sm:w-auto">
            Check my resume
          </Link>
        </div>

        {jobs.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">Open jobs for {batchDef.year} batch</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        {internships.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">{batchDef.year} batch internships</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {internships.map((job) => (<JobCard key={job.id} job={job} basePath="/internships"/>))}
            </div>
          </section>)}

        {jobs.length === 0 && internships.length === 0 && (<p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            No live listings open to the {batchDef.year} batch right now — check back after the next crawl, or{' '}
            <Link href="/jobs" className="underline">browse all open roles</Link>.
          </p>)}

        {companies.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Companies hiring the {batchDef.year} batch</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {companies.map((company) => (<li key={company}>
                  <Link href={`/companies/${companySlug(company)}`} className="chip chip-muted text-xs">
                    {company}
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Get your application ready</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            <li>
              <Link href="/tools/resume-builder" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Build a resume
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/tools/ats-resume-checker" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Check ATS score
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/leetcode" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Practice coding questions
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
          </ul>
        </section>

        <EntityNotes note={BATCH_NOTES[batchDef.year]} idPrefix="batch"/>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Other batches</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (<li key={r.year}>
                  <Link href={`/batch/${r.year}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    {r.year} batch
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <HubExplore batches skipBatchYears={[batchDef.year, ...related.map((r) => r.year)]}/>
      </div>
    </main>);
}

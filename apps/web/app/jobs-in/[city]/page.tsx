// Module: app/jobs-in/[city]/page.tsx
// Defines component(s)/export(s): CityHubPage
// Defines function(s): matchesCity, generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs, type Job } from '@/lib/jobs';
import { canonicalPathForJob } from '@/lib/slug';
import { companySlug } from '@/lib/companies';
import { CITIES, getCityBySlug, getRelatedCities, type CityDefinition } from '@/app/jobs-in/data';
import {  breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import { LOCATION_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';
import JobCard from '@/app/components/JobCard';
import TrackView from '@/app/components/TrackView';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import EntityNotes from '@/app/components/EntityNotes';
import { CITY_NOTES } from '@/lib/content/entityNotes';

export const dynamicParams = false;

const DISPLAY_LIMIT = 24;

// The jobs API only filters by country server-side, so city matching is done here
// against the raw `location` string returned for each job.
function matchesCity(job: Job, city: CityDefinition): boolean {
    const loc = (job.location || '').toLowerCase();
    if (!loc)
        return false;
    return city.matchers.some((m) => loc.includes(m));
}

async function getJobsInCity(city: CityDefinition, type?: string): Promise<Job[]> {
    const jobs = await getJobs({ type, sort: 'ranked', limit: 500 });
    return jobs.filter((job) => matchesCity(job, city));
}

export function generateStaticParams() {
    return CITIES.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params, }: {
    params: { city: string };
}): Promise<Metadata> {
    const city = getCityBySlug(params.city);
    if (!city)
        return {};
    const url = `${BASE_URL}/jobs-in/${city.slug}`;
    // PHASE_PLAN.md Phase 3 item 2: same getJobs() call the page component
    // makes below, deduped by Next.js's fetch cache within one request.
    const [jobs, internships] = await Promise.all([
        getJobsInCity(city, undefined),
        getJobsInCity(city, 'internship'),
    ]);
    return {
        title: city.metaTitle,
        description: city.metaDescription,
        alternates: { canonical: url, languages: languageAlternates(`/jobs-in/${city.slug}`) },
        ...(belowHubThreshold(jobs.length + internships.length, LOCATION_MIN_JOBS)
            ? { robots: { index: false, follow: true } }
            : {}),
        openGraph: {
            type: 'website',
            url,
            title: city.metaTitle,
            description: city.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: `Jobs in ${city.name}` }],
        },
        twitter: {
            card: 'summary_large_image',
            title: city.metaTitle,
            description: city.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}

export default async function CityHubPage({ params, }: {
    params: { city: string };
}) {
    const city = getCityBySlug(params.city);
    if (!city)
        notFound();

    const url = `${BASE_URL}/jobs-in/${city.slug}`;
    const [jobs, internships] = await Promise.all([
        getJobsInCity(city, undefined),
        getJobsInCity(city, 'internship'),
    ]);
    const displayJobs = jobs.slice(0, DISPLAY_LIMIT);
    const displayInternships = internships.slice(0, DISPLAY_LIMIT);
    const related = getRelatedCities(city);
    const companies = Array.from(new Set([...jobs, ...internships].map((j) => j.company))).slice(0, 8);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Jobs by city', url: `${BASE_URL}/jobs-in` },
        { name: city.name, url },
    ]);
    const itemListSchema = {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        itemListElement: displayJobs.map((job, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: `${BASE_URL}${canonicalPathForJob(job)}`,
        })),
    };

    return (<main className="w-full">
      <Script id="city-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>
      <Script id="city-itemlist-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}/>
      <TrackView event="city_hub_view" params={{ city: city.slug }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <p className="eyebrow eyebrow-accent">// {city.region.toLowerCase()}</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          Jobs &amp; Internships in {city.name}
        </h1>
        
        <div className="mt-4 max-w-3xl leading-relaxed text-sm sm:text-base space-y-3" style={{ color: 'var(--ink-soft)' }}>
          <p>{city.heroDescription}</p>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/jobs" className="btn btn-primary">
            Browse all jobs
          </Link>
          <Link href="/tools/ats-resume-checker" className="btn">
            Check my resume
          </Link>
        </div>

        {displayJobs.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">
              Open jobs in {city.name}
              {jobs.length > displayJobs.length && (<span className="ml-2 text-sm font-normal" style={{ color: 'var(--ink-soft)' }}>
                  showing {displayJobs.length} of {jobs.length}
                </span>)}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayJobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        {displayInternships.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">
              Internships in {city.name}
              {internships.length > displayInternships.length && (<span className="ml-2 text-sm font-normal" style={{ color: 'var(--ink-soft)' }}>
                  showing {displayInternships.length} of {internships.length}
                </span>)}
            </h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {displayInternships.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        {displayJobs.length === 0 && displayInternships.length === 0 && (<p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            No live listings for {city.name} right now — check back after the next crawl, or{' '}
            <Link href="/jobs" className="underline">browse all open roles</Link>.
          </p>)}

        {companies.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Companies hiring in {city.name}</h2>
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

        <EntityNotes note={CITY_NOTES[city.slug]} idPrefix="city"/>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Jobs in other cities</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (<li key={r.slug}>
                  <Link href={`/jobs-in/${r.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    Jobs in {r.name}
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}
      </div>
    </main>);
}

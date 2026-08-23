// Module: app/careers/[role]/page.tsx
// Defines component(s)/export(s): CareerHubPage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs } from '@/lib/jobs';
import { canonicalPathForJob } from '@/lib/slug';
import { companySlug } from '@/lib/companies';
import { CAREERS, getCareerBySlug, getRelatedCareers } from '@/app/careers/data';
import { getResumeRoleBySlug } from '@/app/resume-for/data';
import { breadcrumbSchema, faqSchema } from '@/lib/structuredData';
import JobCard from '@/app/components/JobCard';
import TrackView from '@/app/components/TrackView';

export const dynamicParams = false;

export function generateStaticParams() {
    return CAREERS.map((c) => ({ role: c.slug }));
}

export async function generateMetadata({ params, }: {
    params: { role: string };
}): Promise<Metadata> {
    const careerRole = getCareerBySlug(params.role);
    if (!careerRole)
        return {};
    const url = `${BASE_URL}/careers/${careerRole.slug}`;
    return {
        title: careerRole.metaTitle,
        description: careerRole.metaDescription,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            url,
            title: careerRole.metaTitle,
            description: careerRole.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: `${careerRole.name} career path` }],
        },
        twitter: {
            card: 'summary_large_image',
            title: careerRole.metaTitle,
            description: careerRole.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}

export default async function CareerHubPage({ params, }: {
    params: { role: string };
}) {
    const careerRole = getCareerBySlug(params.role);
    if (!careerRole)
        notFound();

    const url = `${BASE_URL}/careers/${careerRole.slug}`;
    const [jobs, internships] = await Promise.all([
        getJobs({ search: careerRole.searchTerm, type: undefined, limit: 6, sort: 'ranked' }),
        getJobs({ search: careerRole.searchTerm, type: 'internship', limit: 6, sort: 'ranked' }),
    ]);
    const related = getRelatedCareers(careerRole);
    const resumeGuide = getResumeRoleBySlug(careerRole.slug);
    const companies = Array.from(new Set([...jobs, ...internships].map((j) => j.company))).slice(0, 8);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Careers', url: `${BASE_URL}/careers` },
        { name: careerRole.name, url },
    ]);
    const faqs = faqSchema([
        {
            question: `What does a ${careerRole.name} actually do?`,
            answer: careerRole.whatTheyDo[0],
        },
        {
            question: `What skills do employers look for in a ${careerRole.name}?`,
            answer: `Skills like ${careerRole.relatedSkillSlugs.map((s) => s.replace(/-/g, ' ')).join(', ')} come up repeatedly in ${careerRole.name} job descriptions — see the live openings above for current specifics.`,
        },
        {
            question: `How many ${careerRole.name} jobs are open right now?`,
            answer: `InternFlow tracks active ${careerRole.name} jobs and internships from company career pages and job boards, refreshed daily — see the live list above for the current count.`,
        },
    ]);

    return (<main className="w-full">
      <Script id="career-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Script id="career-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>
      <TrackView event="career_hub_view" params={{ career: careerRole.slug }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <nav className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href="/careers">Careers</Link> <span aria-hidden="true">/</span> {careerRole.name}
        </nav>

        <p className="eyebrow eyebrow-accent">// career path</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{careerRole.name} Career Path</h1>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{careerRole.heroDescription}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/jobs" className="btn btn-primary">
            Browse all {careerRole.name} jobs
          </Link>
          {resumeGuide && (<Link href={`/resume-for/${resumeGuide.slug}`} className="btn">
              {careerRole.name} resume guide
            </Link>)}
          <Link href="/leetcode" className="btn">
            Practice coding questions
          </Link>
        </div>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">What a {careerRole.name} does</h2>
          <ul className="mt-4 space-y-3">
            {careerRole.whatTheyDo.map((line) => (<li key={line} className="panel p-4 text-sm leading-relaxed">{line}</li>))}
          </ul>
        </section>

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Skills employers look for</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {careerRole.relatedSkillSlugs.map((slug) => (<li key={slug}>
                <Link href={`/skills/${slug}`} className="chip chip-muted text-xs">
                  {slug.replace(/-/g, ' ')}
                </Link>
              </li>))}
          </ul>
        </section>

        {jobs.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Open {careerRole.name} jobs</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        {internships.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">{careerRole.name} internships</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {internships.map((job) => (<JobCard key={job.id} job={job} basePath="/internships"/>))}
            </div>
          </section>)}

        {jobs.length === 0 && internships.length === 0 && (<p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            No live {careerRole.name} listings right now — check back after the next crawl, or{' '}
            <Link href="/jobs" className="underline">browse all open roles</Link>.
          </p>)}

        {companies.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Companies hiring {careerRole.name}s</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {companies.map((company) => (<li key={company}>
                  <Link href={`/companies/${companySlug(company)}`} className="chip chip-muted text-xs">
                    {company}
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Get ready to apply</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {resumeGuide && (<li>
                <Link href={`/resume-for/${resumeGuide.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                  Resume keywords &amp; bullets
                  <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                </Link>
              </li>)}
            <li>
              <Link href="/ats-checker" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
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

        <section className="mt-10 space-y-3">
          <h2 className="display text-xl font-medium">Frequently asked questions</h2>
          {[
            { q: `What does a ${careerRole.name} actually do?`, a: careerRole.whatTheyDo[0] },
            { q: `What skills do employers look for in a ${careerRole.name}?`, a: `Skills like ${careerRole.relatedSkillSlugs.map((s) => s.replace(/-/g, ' ')).join(', ')} come up repeatedly in job descriptions for this role.` },
          ].map((faq) => (<div key={faq.q} className="panel p-4 sm:p-5">
              <p className="font-medium">{faq.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{faq.a}</p>
            </div>))}
        </section>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Related career paths</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (<li key={r.slug}>
                  <Link href={`/careers/${r.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    {r.name}
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}
      </div>
    </main>);
}

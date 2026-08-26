// Module: app/skills/[skill]/page.tsx
// Defines component(s)/export(s): SkillHubPage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs } from '@/lib/jobs';
import { canonicalPathForJob } from '@/lib/slug';
import { companySlug } from '@/lib/companies';
import { SKILLS, getSkillBySlug, getRelatedSkills } from '@/app/skills/data';
import { breadcrumbSchema, faqSchema } from '@/lib/structuredData';
import JobCard from '@/app/components/JobCard';
import TrackView from '@/app/components/TrackView';
import FAQAccordion from '@/app/components/FAQAccordion';

export const dynamicParams = false;

export function generateStaticParams() {
    return SKILLS.map((s) => ({ skill: s.slug }));
}

export async function generateMetadata({ params, }: {
    params: { skill: string };
}): Promise<Metadata> {
    const skill = getSkillBySlug(params.skill);
    if (!skill)
        return {};
    const url = `${BASE_URL}/skills/${skill.slug}`;
    return {
        title: skill.metaTitle,
        description: skill.metaDescription,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            url,
            title: skill.metaTitle,
            description: skill.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: skill.name }],
        },
        twitter: {
            card: 'summary_large_image',
            title: skill.metaTitle,
            description: skill.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}

export default async function SkillHubPage({ params, }: {
    params: { skill: string };
}) {
    const skill = getSkillBySlug(params.skill);
    if (!skill)
        notFound();

    const url = `${BASE_URL}/skills/${skill.slug}`;
    const [jobs, internships] = await Promise.all([
        getJobs({ skill: skill.searchTerm, type: undefined, limit: 9, sort: 'ranked' }),
        getJobs({ skill: skill.searchTerm, type: 'internship', limit: 6, sort: 'ranked' }),
    ]);
    const related = getRelatedSkills(skill);
    const companies = Array.from(new Set(jobs.map((j) => j.company))).slice(0, 8);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Skills', url: `${BASE_URL}/skills` },
        { name: skill.name, url },
    ]);
    const pageFaqs = [
        {
            question: `How many ${skill.name} jobs are open right now?`,
            answer: `InternFlow tracks active ${skill.name} jobs and internships from company career pages and job boards, refreshed daily — see the live list above for the current count.`,
        },
        {
            question: `Do I need a resume tailored for ${skill.name} roles?`,
            answer: `Recruiters and ATS filters scan for skill keywords like "${skill.name}" directly, so it helps to list it explicitly under skills and in relevant project bullets. InternFlow's ATS resume checker and resume builder can help you format this correctly.`,
        },
        {
            question: `Which companies hire for ${skill.name}?`,
            answer: companies.length > 0
                ? `Companies currently hiring for ${skill.name} on InternFlow include ${companies.slice(0, 5).join(', ')}, among others.`
                : `Check the Companies page on InternFlow for the full list of companies actively hiring, and filter by ${skill.name} on the Jobs page.`,
        },
        {
            question: `Is ${skill.name} a hard skill, a technical skill, or a soft skill?`,
            answer: `${skill.name} is a technical skill — a hands-on, verifiable ability specific to ${skill.category.toLowerCase()} work. It belongs in your resume's dedicated skills section and, ideally, backed by a project or a GitHub repo an interviewer can check.`,
        },
    ];
    const faqs = faqSchema(pageFaqs);

    return (<main className="w-full">
      <Script id="skill-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Script id="skill-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>
      <TrackView event="skill_hub_view" params={{ skill: skill.slug }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <nav className="mb-6 flex flex-wrap items-center gap-x-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href="/skills">Skills</Link> <span aria-hidden="true">/</span> <span>{skill.name}</span>
        </nav>

        <p className="eyebrow eyebrow-accent">// {skill.category.toLowerCase()}</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{skill.name} Jobs &amp; Internships</h1>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{skill.heroDescription}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link href={`/jobs?search=${encodeURIComponent(skill.searchTerm)}`} className="btn btn-primary w-full text-center sm:w-auto">
            Browse all {skill.name} jobs
          </Link>
          <Link href="/tools/ats-resume-checker" className="btn w-full text-center sm:w-auto">
            Check my resume for {skill.name}
          </Link>
        </div>

        {jobs.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">Open {skill.name} jobs</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        {internships.length > 0 && (<section className="mt-10">
            <h2 className="display text-xl font-medium">{skill.name} internships</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {internships.map((job) => (<JobCard key={job.id} job={job} basePath="/internships"/>))}
            </div>
          </section>)}

        {jobs.length === 0 && internships.length === 0 && (<p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
            No live {skill.name} listings right now — check back after the next crawl, or{' '}
            <Link href="/jobs" className="underline">browse all open roles</Link>.
          </p>)}

        {companies.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Companies hiring for {skill.name}</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {companies.map((company) => (<li key={company}>
                  <Link href={`/companies/${companySlug(company)}`} className="chip chip-muted text-xs">
                    {company}
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Get ready for {skill.name} interviews</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            <li>
              <Link href="/leetcode" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Practice coding questions
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/github" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                AI review of your {skill.name} code
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/tools/resume-builder" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Build a {skill.name} resume
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
          </ul>
        </section>

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium mb-6">Frequently asked questions</h2>
          <FAQAccordion items={pageFaqs} />
        </section>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Related skills</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (<li key={r.slug}>
                  <Link href={`/skills/${r.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    {r.name}
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}
      </div>
    </main>);
}

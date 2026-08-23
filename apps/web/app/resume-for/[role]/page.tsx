// Module: app/resume-for/[role]/page.tsx
// Defines component(s)/export(s): ResumeForRolePage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL, getJobs } from '@/lib/jobs';
import { canonicalPathForJob } from '@/lib/slug';
import { RESUME_ROLES, getResumeRoleBySlug, getRelatedResumeRoles } from '@/app/resume-for/data';
import { getCareerBySlug } from '@/app/careers/data';
import { breadcrumbSchema, faqSchema } from '@/lib/structuredData';
import JobCard from '@/app/components/JobCard';
import TrackView from '@/app/components/TrackView';

export const dynamicParams = false;

export function generateStaticParams() {
    return RESUME_ROLES.map((r) => ({ role: r.slug }));
}

export async function generateMetadata({ params, }: {
    params: { role: string };
}): Promise<Metadata> {
    const role = getResumeRoleBySlug(params.role);
    if (!role)
        return {};
    const url = `${BASE_URL}/resume-for/${role.slug}`;
    return {
        title: role.metaTitle,
        description: role.metaDescription,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            url,
            title: role.metaTitle,
            description: role.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: `${role.name} resume` }],
        },
        twitter: {
            card: 'summary_large_image',
            title: role.metaTitle,
            description: role.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}

export default async function ResumeForRolePage({ params, }: {
    params: { role: string };
}) {
    const role = getResumeRoleBySlug(params.role);
    if (!role)
        notFound();

    const url = `${BASE_URL}/resume-for/${role.slug}`;
    const jobs = await getJobs({ search: role.searchTerm, sort: 'ranked', limit: 6 });
    const related = getRelatedResumeRoles(role);
    const career = getCareerBySlug(role.slug);

    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Resume guides', url: `${BASE_URL}/resume-for` },
        { name: role.name, url },
    ]);
    const faqs = faqSchema([
        {
            question: `What keywords should a ${role.name} resume include?`,
            answer: `Keywords like ${role.keywordsToInclude.slice(0, 5).join(', ')} are commonly scanned for by ATS systems on ${role.name} roles — the exact list depends on the job description, so match it to keywords actually mentioned in the posting.`,
        },
        {
            question: `How do I check my ${role.name} resume against an ATS?`,
            answer: `InternFlow's free ATS resume checker scores your resume against ${role.name}-specific parsing rules and keywords — paste your resume text and pick "${role.name}" as the target role.`,
        },
        {
            question: `What's the most common mistake on ${role.name} resumes?`,
            answer: role.commonMistakes[0],
        },
    ]);

    return (<main className="w-full">
      <Script id="resume-role-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Script id="resume-role-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>
      <TrackView event="resume_role_view" params={{ role: role.slug }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
        <nav className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href="/resume-for">Resume guides</Link> <span aria-hidden="true">/</span> {role.name}
        </nav>

        <p className="eyebrow eyebrow-accent">// resume guide</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{role.name} Resume — Keywords &amp; Bullet Examples</h1>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{role.heroDescription}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/ats-checker" className="btn btn-primary">
            Check my resume for {role.name} — free
          </Link>
          <Link href="/tools/resume-builder" className="btn">
            Build a resume
          </Link>
          {career && (<Link href={`/careers/${career.slug}`} className="btn">
              {role.name} career hub
            </Link>)}
        </div>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Keywords ATS systems scan for</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            These show up often in {role.name} job descriptions and ATS keyword-match rules. Only include
            ones that are actually true of your experience — an ATS score means nothing if the interview
            exposes the gap.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {role.keywordsToInclude.map((kw) => (<li key={kw} className="chip chip-muted text-xs">{kw}</li>))}
          </ul>
        </section>

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Common mistakes on {role.name} resumes</h2>
          <ul className="mt-4 space-y-3">
            {role.commonMistakes.map((mistake) => (<li key={mistake} className="panel p-4 text-sm leading-relaxed">{mistake}</li>))}
          </ul>
        </section>

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Bullet-point templates</h2>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Fill in the brackets with your own project details and real numbers — a template with fake
            metrics is worse than a plain sentence, since it falls apart the moment someone asks about it.
          </p>
          <ul className="mt-4 space-y-2">
            {role.bulletTemplates.map((bullet) => (<li key={bullet} className="panel p-4 font-mono text-xs leading-relaxed">{bullet}</li>))}
          </ul>
        </section>

        {jobs.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Live {role.name} openings</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalPathForJob(job).split('/')[1]}`}/>))}
            </div>
          </section>)}

        <section className="mt-10 space-y-3">
          <h2 className="display text-xl font-medium">Frequently asked questions</h2>
          {[
            { q: `What keywords should a ${role.name} resume include?`, a: `Keywords like ${role.keywordsToInclude.slice(0, 5).join(', ')} come up often — match your resume to what's actually in the job description you're applying to.` },
            { q: `How do I check my resume against an ATS for this role?`, a: `Use the free ATS checker above and pick "${role.name}" as the target role for a scored breakdown.` },
          ].map((faq) => (<div key={faq.q} className="panel p-4 sm:p-5">
              <p className="font-medium">{faq.q}</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{faq.a}</p>
            </div>))}
        </section>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Resume guides for other roles</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((r) => (<li key={r.slug}>
                  <Link href={`/resume-for/${r.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    {r.name} resume
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}
      </div>
    </main>);
}

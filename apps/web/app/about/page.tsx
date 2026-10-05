// Module: app/about/page.tsx
// Defines component(s)/export(s): AboutPage

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import {  breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';
export const metadata: Metadata = {
    title: 'About InternFlow — AI Code Review & Internship Platform',
    description: 'InternFlow connects to your GitHub, reviews your code like a senior engineer would, and turns that work into an ATS-ready resume tuned for the job you want.',
    alternates: {
        canonical: `${BASE_URL}/about`,
        languages: languageAlternates('/about'),
    },
    openGraph: {
        title: 'About InternFlow',
        description: 'Built by students, for students — InternFlow turns your real GitHub work into proof and into a better resume.',
        url: `${BASE_URL}/about`,
    },
};
const beliefs = [
    {
        title: 'Built by students, for students',
        body: 'We were tired of resumes full of vague bullet points and code reviews that only happen during a job interview. InternFlow turns the work you are already doing into proof, and into a better resume.',
    },
    {
        title: 'Real signal, not templates',
        body: 'Every resume bullet is generated from your actual commits, pull requests, and AI review history, never a generic template filled in with guesses.',
    },
    {
        title: 'One workspace, not a single tool',
        body: 'Listings, a resume builder, an ATS checker, cover letters, an application tracker, and code review, all in one place so each step feeds the next.',
    },
];

const tools = [
    { href: '/internships', name: 'Internships', body: 'Fresh internship listings for students and freshers.' },
    { href: '/jobs', name: 'Jobs', body: 'Entry-level and fresher roles, with top companies first.' },
    { href: '/government-jobs', name: 'Government jobs', body: 'Recruitment notices with vacancies and last dates.' },
    { href: '/companies', name: 'Companies hiring', body: 'See every open role at a company in one place.' },
    { href: '/resume/builder', name: 'Resume builder', body: 'ATS-friendly resumes built from your real work.' },
    { href: '/ats-checker', name: 'ATS resume checker', body: 'Score your resume against a job and find missing keywords.' },
    { href: '/cover-letter', name: 'Cover letter generator', body: 'A first draft from your resume and the job description.' },
    { href: '/tracker', name: 'Application tracker', body: 'Saved, Applied, Interviewing, Offer, with deadline alerts.' },
];

export default function AboutPage() {
    const breadcrumb = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'About', url: `${BASE_URL}/about` },
    ]);
    return (<div className="mx-auto w-full max-w-4xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumb),
        }}/>
      <Breadcrumbs schema={breadcrumb}/>

      <header className="max-w-3xl">
        <h1 className="display text-3xl font-medium leading-tight sm:text-5xl">
          Why InternFlow exists
        </h1>
        <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          InternFlow helps college students and freshers in India find internships
          and entry-level jobs, then get their resume and code ready to apply.
          It connects to your GitHub, reviews your code like a senior engineer
          would, and turns that real work into a resume tuned for the role you
          want, all in one workspace.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn btn-primary">Get started free</Link>
          <Link href="/internships" className="btn btn-secondary">Browse internships</Link>
        </div>
      </header>

      <section className="mt-16" aria-labelledby="beliefs">
        <h2 id="beliefs" className="display text-2xl font-medium">What we believe</h2>
        <div className="mt-6 grid gap-8 sm:grid-cols-3">
          {beliefs.map((b) => (<div key={b.title} className="border-l-2 pl-4" style={{ borderColor: 'var(--indigo)' }}>
              <h3 className="display text-lg font-medium leading-snug">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{b.body}</p>
            </div>))}
        </div>
      </section>

      <section className="mt-16" aria-labelledby="tools">
        <h2 id="tools" className="display text-2xl font-medium">What you can do here</h2>
        <ul className="panel mt-6 grid overflow-hidden sm:grid-cols-2">
          {tools.map((t, i) => (<li key={t.href} className={`${i > 0 ? 'border-t' : ''} ${i === 1 ? 'sm:border-t-0' : ''} ${i >= 2 ? 'sm:border-t' : ''} ${i % 2 === 1 ? 'sm:border-l' : ''}`} style={{ borderColor: 'var(--line)' }}>
              <Link href={t.href} className="block px-5 py-4 transition-colors hover:bg-[var(--paper-dim)]">
                <span className="block text-sm font-semibold">{t.name}</span>
                <span className="mt-0.5 block text-sm leading-snug" style={{ color: 'var(--ink-soft)' }}>{t.body}</span>
              </Link>
            </li>))}
        </ul>
      </section>

      <section className="mt-16 grid gap-10 sm:grid-cols-2" aria-label="Team and contact">
        <div>
          <h2 className="display text-2xl font-medium">Who&apos;s behind it</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            A small product and engineering team, shipping weekly. We dogfood InternFlow on our own repos.
          </p>
        </div>
        <div>
          <h2 className="display text-2xl font-medium">Get in touch</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Questions, feedback, partnership requests, or a job or internship listing you&apos;d like removed:
            email us any time.
          </p>
          <a href="mailto:creatoramplified@gmail.com" className="mt-2 inline-block text-sm font-medium underline underline-offset-2">
            creatoramplified@gmail.com
          </a>
        </div>
      </section>

      <section className="panel-dark mt-16 flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
        <p className="display max-w-lg text-xl font-medium text-white sm:text-2xl">
          Find an internship, build your resume, and track every application in one place.
        </p>
        <Link href="/dashboard" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
          Get started free
        </Link>
      </section>
    </div>);
}

// Module: app/about/page.tsx
// Defines component(s)/export(s): AboutPage

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { breadcrumbSchema, languageAlternates, safeJsonLd } from '@/lib/structuredData';
import { ABOUT_VIDEO, videoObjectSchema } from '@/lib/toolVideos';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import VideoPlayer from '@/app/components/VideoPlayer';

const TITLE = 'About InternFlow: Jobs, Internships & Free Career Tools for Freshers';
const DESCRIPTION = 'InternFlow collects fresher jobs and internships from company career pages and adds free resume, ATS, cover letter and tracking tools for Indian students.';

export const metadata: Metadata = {
    title: { absolute: TITLE },
    description: DESCRIPTION,
    alternates: {
        canonical: `${BASE_URL}/about`,
        languages: languageAlternates('/about'),
    },
    openGraph: {
        title: 'About InternFlow',
        description: DESCRIPTION,
        url: `${BASE_URL}/about`,
    },
};

const beliefs = [
    {
        title: 'Built by students, for students',
        body: 'We were tired of checking dozens of career pages and guessing what recruiters wanted. InternFlow puts the listings in one place, next to the tools we wished we had.',
    },
    {
        title: 'Real listings, real signal',
        body: 'Listings come from company career pages and job boards, with eligibility, skills and batch shown up front, so you can tell in seconds whether a role is worth applying to.',
    },
    {
        title: 'One workspace, not a single tool',
        body: 'Listings, a resume builder, an ATS checker, cover letters, an application tracker and coding practice, all in one place so each step feeds the next.',
    },
];

const STATS = [
    { value: 'Daily', label: 'new listings from career pages' },
    { value: 'Free', label: 'every tool, no account needed' },
    { value: '5', label: 'degrees covered: B.Tech, BCA, MCA, B.Sc, MBA' },
];

const tools = [
    { href: '/internships', name: 'Internships', body: 'Fresh internship listings for students and freshers.' },
    { href: '/jobs', name: 'Jobs', body: 'Entry-level and fresher roles, with top companies first.' },
    { href: '/government-jobs', name: 'Government jobs', body: 'Recruitment notices with vacancies and last dates.' },
    { href: '/companies', name: 'Companies hiring', body: 'See every open role at a company in one place.' },
    { href: '/resume/builder', name: 'Resume builder', body: 'A one-page, ATS-friendly resume in minutes.' },
    { href: '/ats-checker', name: 'ATS resume checker', body: 'Score your resume against a job and find missing keywords.' },
    { href: '/cover-letter', name: 'Cover letter generator', body: 'A first draft from your resume and the job description.' },
    { href: '/tracker', name: 'Application tracker', body: 'Saved, Applied, Interviewing, Offer, with deadline alerts.' },
];

export default function AboutPage() {
    const breadcrumb = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'About', url: `${BASE_URL}/about` },
    ]);
    return (<div className="mx-auto w-full max-w-6xl">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(breadcrumb) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(videoObjectSchema(ABOUT_VIDEO, `${BASE_URL}/about`)) }}/>
      <Breadcrumbs schema={breadcrumb}/>

      <header className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
          <p className="eyebrow eyebrow-accent mb-3">// about InternFlow</p>
          <h1 className="display text-3xl font-medium leading-tight sm:text-5xl">
            Why InternFlow exists
          </h1>
          <p className="mt-5 text-lg leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            InternFlow helps college students and freshers in India find internships and entry-level jobs,
            then get their resume ready to apply. We collect openings from company career pages every day
            and pair them with free tools for each step, from the first search to the offer.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/jobs" className="btn btn-primary">Browse jobs free</Link>
            <Link href="/internships" className="btn btn-secondary">Browse internships</Link>
          </div>
        </div>
        <figure className="m-0">
          <VideoPlayer video={ABOUT_VIDEO} frame="browser" priority/>
          <figcaption className="mt-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
            {ABOUT_VIDEO.body}
          </figcaption>
        </figure>
      </header>

      <section aria-label="InternFlow at a glance" className="mt-14 grid gap-4 sm:grid-cols-3">
        {STATS.map((s) => (<div key={s.label} className="panel p-5">
            <p className="display text-3xl font-semibold" style={{ color: 'var(--indigo)' }}>{s.value}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{s.label}</p>
          </div>))}
      </section>

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
        <p className="mt-2 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>
          Each tool page has a short recording of the tool in use, so you can see it before you try it.
        </p>
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
            A small product and engineering team, shipping weekly. We use InternFlow ourselves.
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
        <Link href="/jobs" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
          Browse jobs free
        </Link>
      </section>
    </div>);
}

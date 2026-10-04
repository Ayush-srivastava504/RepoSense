'use client';

import Link from 'next/link';
import MagneticLink from './MagneticLink';
import ScrollReveal from './ScrollReveal';
import JobCard from './JobCard';
import HomeHero from './HomeHero';
import HomeFaq from './HomeFaq';

interface Props {
  previewJobs: any[];
}

const DEGREE_CARDS = [
  {
    tag: 'B.Tech / BE',
    title: 'Engineering graduates',
    body: 'Software engineer, backend and full-stack, data engineer, AI/ML and DevOps roles for CSE, IT and ECE freshers.',
    links: [
      { href: '/careers/software-engineer', label: 'Software Engineer' },
      { href: '/careers/data-engineer', label: 'Data Engineer' },
      { href: '/careers/ai-ml-engineer', label: 'AI / ML' },
    ],
  },
  {
    tag: 'BCA / B.Sc',
    title: 'Computer science & IT graduates',
    body: 'Web developer, QA, support engineer and data analyst openings that welcome BCA and B.Sc CS/IT candidates.',
    links: [
      { href: '/skills/react', label: 'React jobs' },
      { href: '/careers/data-analyst', label: 'Data Analyst' },
      { href: '/internships', label: 'Internships' },
    ],
  },
  {
    tag: 'MCA',
    title: 'Master of Computer Applications',
    body: 'Software engineer, data engineer and cloud roles. Stand out with Python, SQL, Java and one cloud platform.',
    links: [
      { href: '/skills/python', label: 'Python jobs' },
      { href: '/skills/sql', label: 'SQL jobs' },
      { href: '/skills/aws', label: 'AWS jobs' },
    ],
  },
  {
    tag: 'MBA',
    title: 'Management graduates',
    body: 'Business analyst, data analyst, operations and marketing roles. Excel, SQL and Power BI make a clear difference.',
    links: [
      { href: '/careers/data-analyst', label: 'Analyst roles' },
      { href: '/skills/excel', label: 'Excel jobs' },
      { href: '/skills/power-bi', label: 'Power BI jobs' },
    ],
  },
];

const ROLES = [
  { href: '/careers/software-engineer', title: 'Software Engineer', body: 'Backend, frontend and full-stack jobs and internships for freshers.' },
  { href: '/careers/data-engineer', title: 'Data Engineer', body: 'Pipelines, SQL, Spark and cloud data roles for new graduates.' },
  { href: '/careers/ai-ml-engineer', title: 'AI / ML Engineer', body: 'Machine learning and AI openings, from intern to junior level.' },
  { href: '/careers/devops-engineer', title: 'DevOps & Cloud', body: 'AWS, Docker, Kubernetes and CI/CD roles for entry-level engineers.' },
  { href: '/careers/data-analyst', title: 'Data Analyst', body: 'SQL, Excel, Power BI and Python analyst roles for fresh graduates.' },
  { href: '/internships', title: 'IT Internships', body: 'Paid and remote tech internships to build experience before you graduate.' },
];

const STEPS = [
  { n: '01', title: 'Find roles that fit your degree', body: 'Browse jobs and internships by role, skill, city or passout batch, or search directly.' },
  { n: '02', title: 'Make an ATS-ready resume', body: 'Build a one-page resume, then check it against the job description before you apply.' },
  { n: '03', title: 'Apply and keep track', body: 'Write a tailored cover letter, apply on the company page and track every application.' },
];

const CITIES = [
  { href: '/jobs-in/bangalore', label: 'Bangalore' },
  { href: '/jobs-in/hyderabad', label: 'Hyderabad' },
  { href: '/jobs-in/pune', label: 'Pune' },
  { href: '/jobs-in/chennai', label: 'Chennai' },
  { href: '/jobs-in/delhi-ncr', label: 'Delhi NCR' },
];
const BATCHES = ['2025', '2026', '2027', '2028'];

const TOOLS = [
  { href: '/resume/builder', title: 'Resume builder', body: 'Clean, ATS-friendly resume made for freshers.' },
  { href: '/ats-checker', title: 'ATS resume checker', body: 'Score your resume against a job description.' },
  { href: '/cover-letter', title: 'Cover letter generator', body: 'Draft a tailored cover letter in seconds.' },
  { href: '/leetcode', title: 'Coding practice', body: 'Practise DSA problems for tech interviews.' },
];

export default function MultilingualLanding({ previewJobs }: Props) {
  return (
    <>
      <HomeHero previewJobs={previewJobs} />

      {/* By degree */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <p className="eyebrow eyebrow-accent mb-2">// pick your degree</p>
        <h2 className="display text-2xl font-medium mb-2">Jobs for B.Tech, BCA, MCA, B.Sc and MBA freshers</h2>
        <p className="max-w-2xl text-sm leading-relaxed mb-8" style={{ color: 'var(--ink-soft)' }}>
          Start from your degree and see which roles and skills to focus on first.
        </p>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {DEGREE_CARDS.map((d) => (
            <div key={d.tag} className="panel card-lift flex flex-col p-5">
              <p className="eyebrow eyebrow-accent">// {d.tag}</p>
              <h3 className="display mt-2 text-lg font-medium">{d.title}</h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{d.body}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {d.links.map((l) => (
                  <Link key={l.href} href={l.href} className="chip chip-indigo text-[11px] transition hover:opacity-80">{l.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* Popular roles */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// popular roles</p>
        <h2 className="display text-2xl font-medium mb-8">Software, data and AI roles hiring freshers</h2>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="panel card-lift block p-5">
              <h3 className="display text-base font-medium">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{r.body}</p>
            </Link>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* Latest listings */}
      {previewJobs.length > 0 && (
        <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
          <hr className="hr-line mb-10" />
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow eyebrow-accent mb-2">// open right now</p>
              <h2 className="display text-2xl font-medium">Latest jobs and internships</h2>
            </div>
            <Link href="/jobs" className="btn btn-secondary text-sm">See all listings</Link>
          </div>
          <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewJobs.slice(0, 6).map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </ScrollReveal>
        </ScrollReveal>
      )}

      {/* How it works */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// how it works</p>
        <h2 className="display text-2xl font-medium mb-8">From search to application in three steps</h2>
        <ScrollReveal as="div" stagger className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full text-sm font-semibold" style={{ background: 'var(--indigo)', color: '#fff' }}>{s.n}</div>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{s.body}</p>
            </div>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* City & batch */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <p className="eyebrow eyebrow-accent mb-2">// by city</p>
            <h2 className="display text-xl font-medium mb-4">IT jobs in top Indian cities</h2>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (<Link key={c.href} href={c.href} className="chip chip-muted transition hover:opacity-80">{c.label}</Link>))}
              <Link href="/jobs-in" className="chip chip-indigo">All cities</Link>
            </div>
          </div>
          <div>
            <p className="eyebrow eyebrow-accent mb-2">// by passout batch</p>
            <h2 className="display text-xl font-medium mb-4">Openings for your graduation year</h2>
            <div className="flex flex-wrap gap-2">
              {BATCHES.map((y) => (<Link key={y} href={`/batch/${y}`} className="chip chip-muted transition hover:opacity-80">{y} batch</Link>))}
              <Link href="/batch" className="chip chip-indigo">All batches</Link>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* Tools */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// free tools</p>
        <h2 className="display text-2xl font-medium mb-8">Get your application ready</h2>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TOOLS.map((t) => (
            <Link key={t.href} href={t.href} className="panel card-lift block p-5">
              <h3 className="display text-base font-medium">{t.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{t.body}</p>
            </Link>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* About (short, honest copy) */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// about InternFlow</p>
        <h2 className="display text-2xl font-medium mb-5">A job and internship search built for Indian freshers</h2>
        <div className="max-w-3xl space-y-4 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          <p>
            InternFlow collects <Link href="/jobs" className="underline">jobs</Link> and{' '}
            <Link href="/internships" className="underline">internships</Link> from company career pages and job boards, so you do
            not have to check dozens of sites. It is aimed at B.Tech, BCA, MCA, B.Sc and MBA students and recent graduates looking
            for their first role in software, data, AI, cloud or analytics.
          </p>
          <p>
            Filter by role, skill, city or passout batch, then use the{' '}
            <Link href="/resume/builder" className="underline">resume builder</Link>,{' '}
            <Link href="/ats-checker" className="underline">ATS checker</Link> and{' '}
            <Link href="/cover-letter" className="underline">cover letter generator</Link> before you apply. Read our{' '}
            <Link href="/blog" className="underline">blog</Link> for interview preparation and resume guides.
          </p>
        </div>
      </ScrollReveal>

      {/* FAQ */}
      <ScrollReveal as="section" className="container-xl py-10 sm:py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// frequently asked</p>
        <h2 className="display text-2xl font-medium mb-6">Fresher jobs in India: common questions</h2>
        <HomeFaq />
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal as="section" className="container-xl pb-16 sm:pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>// ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Find your first IT job or internship today.
            </p>
          </div>
          <MagneticLink href="/jobs" className="btn btn-primary flex-shrink-0 whitespace-nowrap">Browse jobs free</MagneticLink>
        </div>
      </ScrollReveal>
    </>
  );
}

// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage
//
//

import Link from 'next/link';
import type { Metadata } from 'next';
import AuroraBackground from '@/app/components/AuroraBackground';
import MagneticLink from '@/app/components/MagneticLink';
import ScrollReveal from '@/app/components/ScrollReveal';
import AuthRedirect from '@/app/components/AuthRedirect';
import JobCard from '@/app/components/JobCard';
import HomeSEOContent from '@/app/components/HomeSEOContent';
import FAQAccordion from '@/app/components/FAQAccordion';
import { getFeaturedJobs, getJobs } from '@/lib/jobs';

// SEO Metadata
export const metadata: Metadata = {
  title: 'InternFlow - High Paying Jobs, Internships & AI Career Tools for Students',
  description: 'Find high paying jobs, remote devops jobs, AI engineer jobs, and internships. Free AI resume generator, cover letter templates, and ATS-friendly resume builder for students.',
  keywords: 'high paying jobs, vertical jobs, cisco intern, ai engineer jobs, devops jobs, remote devops jobs, cover letter templates, cover letter example, data engineer, data engineer jobs, how to write a cover letter, cover letter examples, what is a cover letter, data engineer salary, aws data engineer certification, remote job, part time remote job, remote job opportunities, what is a remote job, remote job openings, remote job no experience, remote job search, remote jobs hiring, customer service remote jobs, best remote jobs, fully remote jobs, remote government jobs, government jobs near me, interview questions, common interview questions, how to prepare for an interview, the intern, software engineer intern, marketing intern, finance intern, interns, do interns get paid, the internship, star method for interviews, data analyst internship, internship definition, what is internship, resume generator, jobs near me, jobs hiring near me, indeed jobs, remote jobs, amazon jobs, cybersecurity internships, internships near me, jobs, part time jobs near me, entry level jobs, data entry jobs, nursing jobs, summer jobs, engineering jobs, best AI tools, computer science internships, ey internships, resume now, it internships, my perfect resume, resume builder free, skills for resume, resume maker, marketing internships, ATS resume, ATS friendly resume, google internships, ATS resume template, LinkedIn profile, LinkedIn jobs',
  openGraph: {
    title: 'InternFlow - AI-Powered Career Platform for High Paying Jobs & Internships',
    description: 'Get AI code reviews, generate ATS-friendly resumes, and find high paying jobs, remote devops jobs, and internships. Free tools for students.',
    url: 'https://internflow.com',
    siteName: 'InternFlow',
    images: [
      {
        url: 'https://internflow.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'InternFlow - AI Career Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InternFlow - Find High Paying Jobs & Internships',
    description: 'AI-powered resume builder, cover letter templates, and job search platform for students.',
    images: ['https://internflow.com/twitter-image.jpg'],
  },
  alternates: {
    canonical: 'https://internflow.com',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

// The simple, 4-step intern flow shown in the middle of the page.
const internFlow = [
    {
        num: '01',
        tag: 'discover',
        title: 'Find the role',
        body: 'Search jobs, internships, and remote roles crawled daily from company career pages, Indeed, and LinkedIn Jobs.',
    },
    {
        num: '02',
        tag: 'apply',
        title: 'Apply with confidence',
        body: 'Generate an ATS-ready resume and a tailored cover letter for the exact listing in a couple of minutes.',
    },
    {
        num: '03',
        tag: 'track',
        title: 'Track every application',
        body: 'Log statuses, deadlines, and follow-ups in one tracker instead of a scattered spreadsheet.',
    },
    {
        num: '04',
        tag: 'land it',
        title: 'Prep and get hired',
        body: 'Practice with STAR-method stories and common interview questions before the call.',
    },
];

const features = [
    {
        tag: 'jobs',
        title: 'One feed, every source',
        body: 'Jobs, internships, remote roles, and government jobs — crawled daily and organised so you search once, not across ten tabs.',
    },
    {
        tag: 'resume',
        title: 'Resume from real work',
        body: 'Turn your GitHub commits and project work into ATS-ready resume bullets, tuned to a specific job description.',
    },
    {
        tag: 'ats',
        title: 'ATS checker + cover letters',
        body: 'Score your resume against a job description, then draft a tailored cover letter in seconds.',
    },
    {
        tag: 'tracker',
        title: 'Application tracker',
        body: 'Every application, deadline, and interview in one board so nothing slips through.',
    },
];

const categoryLinks = [
    { href: '/jobs', label: 'All jobs', body: 'Every open listing across India, remote, and abroad.' },
    { href: '/internships', label: 'Internships', body: 'India, remote, and Japan — refreshed daily.' },
    { href: '/remote-jobs', label: 'Remote jobs', body: 'Fully remote roles from US, UK, and worldwide.' },
    { href: '/government-jobs', label: 'Government jobs', body: 'Sarkari Naukri notifications, tracked daily.' },
    { href: '/companies', label: 'Companies hiring', body: 'Top employers, mass-hiring drives, and startups.' },
    { href: '/tools', label: 'AI career tools', body: 'Resume builder, ATS checker, and more — free.' },
];

export default async function LandingPage() {
    const featured = await getFeaturedJobs({ limit: 6 });
    const previewJobs = featured.length > 0 ? featured : await getJobs({ sort: 'recent', limit: 6 });

    return (<>
      <AuthRedirect />

      {/* Hero */}
      <section className="hero-reveal relative container-xl grid items-center gap-10 overflow-hidden py-12 md:py-20">
        <AuroraBackground particleCount={12}/>

        <div className="relative z-10 max-w-2xl">
          <p data-reveal="0" className="eyebrow eyebrow-accent mb-3">// jobs, internships &amp; resume tools</p>
          <h1 data-reveal="1" className="display text-[2rem] font-medium leading-[1.1] sm:text-[2.75rem]">
            Your job search, internship hunt, and resume — in one place.
          </h1>
          <p data-reveal="2" className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            InternFlow crawls listings from across the web every day, then helps you apply with
            an ATS-ready resume and a tailored cover letter — without juggling ten different tabs.
          </p>

          <div data-reveal="3" className="mt-5 flex flex-wrap gap-3">
            <span className="chip chip-green">New listings daily</span>
            <span className="chip chip-green">Jobs, internships &amp; remote</span>
            <span className="chip chip-green">Free resume &amp; ATS tools</span>
          </div>

          <div data-reveal="4" className="mt-7 flex flex-wrap items-center gap-3">
            <MagneticLink href="/jobs" className="btn btn-primary">
              Browse jobs
            </MagneticLink>
            <Link href="/resume/builder" className="btn btn-secondary transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]">
              Build my resume
            </Link>
          </div>
        </div>
      </section>

      {/* Intern Flow — simple, 4-step visual in the middle of the page */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// the intern flow</p>
        <h2 className="display text-2xl font-medium mb-2">From search to signed offer</h2>
        <p className="max-w-xl text-sm leading-relaxed mb-10" style={{ color: 'var(--ink-soft)' }}>
          One simple loop, start to finish — no need to piece it together across separate sites.
        </p>

        <ScrollReveal as="div" stagger className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* connecting line, desktop only */}
          <div className="pointer-events-none absolute left-0 right-0 top-6 hidden lg:block" style={{ height: '1px', background: 'var(--line)' }}/>

          {internFlow.map((s) => (<div key={s.num} className="relative">
              <div
                className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: 'var(--indigo)', color: '#fff' }}
              >
                {s.num}
              </div>
              <p className="eyebrow eyebrow-accent mb-1.5">// {s.tag}</p>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{s.body}</p>
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      {/* What's inside */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// what's inside</p>
        <h2 className="display text-2xl font-medium mb-8">Everything in one workspace</h2>
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (<div key={f.tag} className="panel card-lift p-6">
              <p className="eyebrow eyebrow-accent">// {f.tag}</p>
              <h3 className="display mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{f.body}</p>
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      {/* Featured jobs from this week's crawl */}
      {previewJobs.length > 0 && (<ScrollReveal as="section" className="container-xl py-14">
          <hr className="hr-line mb-10"/>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div>
              <p className="eyebrow eyebrow-accent mb-2">// open right now</p>
              <h2 className="display text-2xl font-medium">Jobs and internships from this week's crawl</h2>
            </div>
            <Link href="/jobs" className="btn btn-secondary text-sm transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]">
              See all listings
            </Link>
          </div>
          <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewJobs.slice(0, 6).map((j) => (<JobCard key={j.id} job={j}/>))}
          </ScrollReveal>
          <p className="mt-5 text-sm text-center" style={{ color: 'var(--muted)' }}>
            Browse the full feed and apply directly — no account needed.
          </p>
        </ScrollReveal>)}

      {/* Browse by category */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// browse by category</p>
        <h2 className="display text-2xl font-medium mb-8">Find what you're looking for</h2>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryLinks.map((c) => (<Link key={c.href} href={c.href} className="panel card-lift p-5 block">
              <h3 className="display text-base font-medium">{c.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {c.body}
              </p>
            </Link>))}
        </ScrollReveal>
      </ScrollReveal>

      {/* About InternFlow — long-form SEO copy */}
      <HomeSEOContent />

      {/* FAQ */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// frequently asked</p>
        <h2 className="display text-2xl font-medium mb-8">Questions about jobs, internships, and resumes</h2>
        <FAQAccordion />
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal as="section" className="container-xl pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>// ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Stop hunting across ten tabs. Start applying from one.
            </p>
          </div>
          <MagneticLink href="/jobs" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
            Browse jobs free
          </MagneticLink>
        </div>
      </ScrollReveal>
    </>);
}

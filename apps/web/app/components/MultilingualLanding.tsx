'use client';

import Link from 'next/link';
import AuroraBackground from './AuroraBackground';
import MagneticLink from './MagneticLink';
import ScrollReveal from './ScrollReveal';
import JobCard from './JobCard';
import HomeSEOContent from './HomeSEOContent';
import FAQAccordion from './FAQAccordion';
import { useTranslation } from '@/i18n/LanguageContext';

interface Props {
  previewJobs: any[];
}

export default function MultilingualLanding({ previewJobs }: Props) {
  const { t, dict } = useTranslation();

  const flowSteps = dict.flow?.steps || [
    {
      tag: 'discover',
      title: 'Find the role',
      body: 'Search jobs, internships, and remote roles crawled daily from company career pages, Indeed, and LinkedIn Jobs.',
    },
    {
      tag: 'apply',
      title: 'Apply with confidence',
      body: 'Generate an ATS-ready resume and a tailored cover letter for the exact listing in a couple of minutes.',
    },
    {
      tag: 'track',
      title: 'Track every application',
      body: 'Log statuses, deadlines, and follow-ups in one tracker instead of a scattered spreadsheet.',
    },
    {
      tag: 'land it',
      title: 'Prep and get hired',
      body: 'Practice with STAR-method stories and common interview questions before the call.',
    },
  ];

  const featureItems = dict.features?.items || [
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

  const categoryCards = [
    { href: '/jobs', label: dict.categories?.items?.[0]?.label || 'All jobs', body: dict.categories?.items?.[0]?.body || 'Every open listing across India, remote, and abroad.' },
    { href: '/internships', label: dict.categories?.items?.[1]?.label || 'Internships', body: dict.categories?.items?.[1]?.body || 'India, remote, and Japan — refreshed daily.' },
    { href: '/remote-jobs', label: dict.categories?.items?.[2]?.label || 'Remote jobs', body: dict.categories?.items?.[2]?.body || 'Fully remote roles from US, UK, and worldwide.' },
    { href: '/government-jobs', label: dict.categories?.items?.[3]?.label || 'Government jobs', body: dict.categories?.items?.[3]?.body || 'Sarkari Naukri notifications, tracked daily.' },
    { href: '/companies', label: dict.categories?.items?.[4]?.label || 'Companies hiring', body: dict.categories?.items?.[4]?.body || 'Top employers, mass-hiring drives, and startups.' },
    { href: '/tools', label: dict.categories?.items?.[5]?.label || 'AI career tools', body: dict.categories?.items?.[5]?.body || 'Resume builder, ATS checker, and more — free.' },
  ];

  return (
    <>
      {/* Hero */}
      <section className="hero-reveal relative container-xl grid items-center gap-10 overflow-hidden py-12 md:py-20">
        <AuroraBackground particleCount={12} />

        <div className="relative z-10 max-w-2xl">
          <p data-reveal="0" className="eyebrow eyebrow-accent mb-3">
            {t('hero.eyebrow', '// jobs, internships & resume tools')}
          </p>
          <h1 data-reveal="1" className="display text-[2rem] font-medium leading-[1.1] sm:text-[2.75rem]">
            {t('hero.title', 'Your job search, internship hunt, and resume — in one place.')}
          </h1>
          <p data-reveal="2" className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {t('hero.subtitle', 'InternFlow crawls listings from across the web every day, then helps you apply with an ATS-ready resume and a tailored cover letter — without juggling ten different tabs.')}
          </p>

          <div data-reveal="3" className="mt-5 flex flex-wrap gap-3">
            <span className="chip chip-green">{t('hero.chipDaily', 'New listings daily')}</span>
            <span className="chip chip-green">{t('hero.chipJobs', 'Jobs, internships & remote')}</span>
            <span className="chip chip-green">{t('hero.chipFree', 'Free resume & ATS tools')}</span>
          </div>

          <div data-reveal="4" className="mt-7 flex flex-wrap items-center gap-3">
            <MagneticLink href="/jobs" className="btn btn-primary">
              {t('hero.browseJobs', 'Browse jobs')}
            </MagneticLink>
            <Link
              href="/resume/builder"
              className="btn btn-secondary transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
            >
              {t('hero.buildResume', 'Build my resume')}
            </Link>
          </div>
        </div>
      </section>

      {/* Intern Flow */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">{t('flow.eyebrow', '// the intern flow')}</p>
        <h2 className="display text-2xl font-medium mb-2">{t('flow.title', 'From search to signed offer')}</h2>
        <p className="max-w-xl text-sm leading-relaxed mb-10" style={{ color: 'var(--ink-soft)' }}>
          {t('flow.subtitle', 'One simple loop, start to finish — no need to piece it together across separate sites.')}
        </p>

        <ScrollReveal as="div" stagger className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div
            className="pointer-events-none absolute left-0 right-0 top-6 hidden lg:block"
            style={{ height: '1px', background: 'var(--line)' }}
          />

          {flowSteps.map((s: any, idx: number) => (
            <div key={idx} className="relative">
              <div
                className="relative z-10 mb-4 flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold"
                style={{ background: 'var(--indigo)', color: '#fff' }}
              >
                0{idx + 1}
              </div>
              <p className="eyebrow eyebrow-accent mb-1.5">// {s.tag}</p>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {s.body}
              </p>
            </div>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* What's inside */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">{t('features.eyebrow', "// what's inside")}</p>
        <h2 className="display text-2xl font-medium mb-8">
          {t('features.title', 'Everything in one workspace')}
        </h2>
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featureItems.map((f: any, idx: number) => (
            <div key={idx} className="panel card-lift p-6">
              <p className="eyebrow eyebrow-accent">// {f.tag}</p>
              <h3 className="display mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {f.body}
              </p>
            </div>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* Featured jobs */}
      {previewJobs.length > 0 && (
        <ScrollReveal as="section" className="container-xl py-14">
          <hr className="hr-line mb-10" />
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div>
              <p className="eyebrow eyebrow-accent mb-2">{t('common.openNow', '// open right now')}</p>
              <h2 className="display text-2xl font-medium">
                {t('common.jobsThisWeek', "Jobs and internships from this week's crawl")}
              </h2>
            </div>
            <Link
              href="/jobs"
              className="btn btn-secondary text-sm transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]"
            >
              {t('common.seeAll', 'See all listings')}
            </Link>
          </div>
          <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewJobs.slice(0, 6).map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </ScrollReveal>
          <p className="mt-5 text-sm text-center" style={{ color: 'var(--muted)' }}>
            {t('common.browseFull', 'Browse the full feed and apply directly — no account needed.')}
          </p>
        </ScrollReveal>
      )}

      {/* Browse by category */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">{t('categories.eyebrow', '// browse by category')}</p>
        <h2 className="display text-2xl font-medium mb-8">
          {t('categories.title', "Find what you're looking for")}
        </h2>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryCards.map((c, i) => (
            <Link key={i} href={c.href} className="panel card-lift p-5 block">
              <h3 className="display text-base font-medium">{c.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {c.body}
              </p>
            </Link>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* About InternFlow long-form content */}
      <HomeSEOContent />

      {/* FAQ */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">{t('common.faq', '// frequently asked')}</p>
        <h2 className="display text-2xl font-medium mb-8">
          {t('common.faqTitle', 'Questions about jobs, internships, and resumes')}
        </h2>
        <FAQAccordion />
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal as="section" className="container-xl pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>
              {t('cta.eyebrow', '// ready when you are')}
            </p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              {t('cta.title', 'Stop hunting across ten tabs. Start applying from one.')}
            </p>
          </div>
          <MagneticLink href="/jobs" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
            {t('cta.button', 'Browse jobs free')}
          </MagneticLink>
        </div>
      </ScrollReveal>
    </>
  );
}

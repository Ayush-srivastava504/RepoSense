// Module: app/components/MultilingualLanding.tsx
// The homepage body. Order: hero (main video) -> find / apply / track feature rows (one video each)
// -> latest listings -> more free tools (poster cards linking to each tool page, where its video
// plays) -> by degree -> browse by role, city and batch -> about (video) -> FAQ -> CTA.
'use client';

import Link from 'next/link';
import Image from 'next/image';
import MagneticLink from './MagneticLink';
import ScrollReveal from './ScrollReveal';
import JobCard from './JobCard';
import HomeHero from './HomeHero';
import HomeFaq from './HomeFaq';
import VideoPlayer from './VideoPlayer';
import { ABOUT_VIDEO, getToolVideo } from '@/lib/toolVideos';

interface Props {
  previewJobs: any[];
}

const FEATURES = [
  {
    n: '01',
    tag: 'find',
    video: getToolVideo('job-details'),
    title: 'Jobs that fit your degree, with a match score on every listing',
    body: 'Search software, data, AI and analyst roles from company career pages. Each listing shows who is eligible, the skills it asks for and how well your profile matches.',
    points: ['Filter by role, skill, city or passout batch', 'Top companies and Big 4 listed first', 'Apply directly on the company page'],
    cta: { href: '/jobs', label: 'Browse jobs' },
    secondary: { href: '/internships', label: 'See internships' },
  },
  {
    n: '02',
    tag: 'apply',
    video: getToolVideo('ats-checker'),
    title: 'A resume that gets past the ATS and in front of a recruiter',
    body: 'Score your resume against the role you want, see the keywords you are missing, then fix them in the resume builder and write a matching cover letter.',
    points: ['ATS score with a list of failed checks', 'One-page, recruiter-readable resume template', 'Cover letter drafted from the job post'],
    cta: { href: '/ats-checker', label: 'Check my resume' },
    secondary: { href: '/resume/builder', label: 'Build a resume' },
  },
  {
    n: '03',
    tag: 'track',
    video: getToolVideo('tracker'),
    title: 'Every application in one place, deadlines included',
    body: 'Save a job in one tap and move it from Saved to Applied, Interviewing and Offer. You get a reminder before a deadline passes, and your data stays in your browser.',
    points: ['Kanban board from saved to offer', 'Deadline reminders', 'No account or sign-up needed'],
    cta: { href: '/tracker', label: 'Open the tracker' },
    secondary: null,
  },
];

const MORE_TOOLS = ['resume-builder', 'cover-letter', 'linkedin', 'auto-apply', 'coding-practice', 'companies'].map(getToolVideo);

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

const CITIES = [
  { href: '/jobs-in/bangalore', label: 'Bangalore' },
  { href: '/jobs-in/hyderabad', label: 'Hyderabad' },
  { href: '/jobs-in/pune', label: 'Pune' },
  { href: '/jobs-in/chennai', label: 'Chennai' },
  { href: '/jobs-in/delhi-ncr', label: 'Delhi NCR' },
];
const BATCHES = ['2025', '2026', '2027', '2028'];

function SectionHead({ eyebrow, title, intro, id }: { eyebrow: string; title: string; intro?: string; id?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="eyebrow eyebrow-accent mb-2">// {eyebrow}</p>
      <h2 id={id} className="display text-2xl font-medium sm:text-3xl">{title}</h2>
      {intro && <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-soft)' }}>{intro}</p>}
    </div>
  );
}

function Tick() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none" style={{ color: 'var(--green)' }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function MultilingualLanding({ previewJobs }: Props) {
  return (
    <>
      <HomeHero />

      {/* Find / apply / track, each with its recording */}
      <section className="container-xl py-12 sm:py-16" aria-labelledby="how-it-helps">
        <SectionHead
          id="how-it-helps"
          eyebrow="how it works"
          title="From search to offer in three steps"
          intro="Find a role that fits your degree, make your resume ready for it, then keep track until you hear back. Every step below is a short recording of the live site."
        />
        <div className="space-y-16 sm:space-y-24">
          {FEATURES.map((f, idx) => (
            <ScrollReveal key={f.n} as="div" className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
              <div className={idx % 2 === 1 ? 'lg:order-2' : ''}>
                <VideoPlayer video={f.video} frame="browser" />
              </div>
              <div>
                <p className="eyebrow eyebrow-accent">
                  <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--indigo)', color: 'var(--paper)' }}>{f.n}</span>
                  {f.tag}
                </p>
                <h3 className="display mt-3 text-xl font-medium leading-snug sm:text-2xl">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-soft)' }}>{f.body}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {f.points.map((p) => (<li key={p} className="flex gap-2"><Tick />{p}</li>))}
                </ul>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link href={f.cta.href} className="btn btn-primary">{f.cta.label}</Link>
                  {f.secondary && <Link href={f.secondary.href} className="btn btn-secondary">{f.secondary.label}</Link>}
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Latest listings */}
      {previewJobs.length > 0 && (
        <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
          <hr className="hr-line mb-12" />
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow eyebrow-accent mb-2">// open right now</p>
              <h2 className="display text-2xl font-medium sm:text-3xl">Latest jobs and internships</h2>
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

      {/* More tools: posters link to each tool page, where the recording plays */}
      <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
        <hr className="hr-line mb-12" />
        <SectionHead
          id="tools-in-action"
          eyebrow="more free tools"
          title="Six more tools, all free"
          intro="Open any tool to watch a short recording of it and try it straight away. None of them need an account."
        />
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {MORE_TOOLS.map((t) => (
            <Link key={t.slug} href={t.href} className="panel card-lift group flex flex-col overflow-hidden">
              <div className="relative aspect-video w-full overflow-hidden" style={{ background: 'var(--paper-dim)' }}>
                <Image
                  src={`/videos/${t.slug}.jpg`}
                  alt={`${t.title} on InternFlow`}
                  width={960}
                  height={540}
                  sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw"
                  className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-[1.03]"
                />
                <span className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium shadow" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                  {t.seconds}s demo
                </span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h3 className="display text-base font-medium">{t.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{t.body}</p>
                <span className="mt-3 text-sm font-medium" style={{ color: 'var(--indigo)' }}>Watch and try it →</span>
              </div>
            </Link>
          ))}
        </ScrollReveal>
      </ScrollReveal>

      {/* By degree */}
      <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
        <hr className="hr-line mb-12" />
        <SectionHead
          eyebrow="pick your degree"
          title="Jobs for B.Tech, BCA, MCA, B.Sc and MBA freshers"
          intro="Start from your degree and see which roles and skills to focus on first."
        />
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

      {/* Browse by role, city and batch */}
      <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
        <hr className="hr-line mb-12" />
        <SectionHead eyebrow="popular roles" title="Software, data and AI roles hiring freshers" />
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ROLES.map((r) => (
            <Link key={r.href} href={r.href} className="panel card-lift block p-5">
              <h3 className="display text-base font-medium">{r.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{r.body}</p>
            </Link>
          ))}
        </ScrollReveal>
        <div className="mt-10 grid gap-8 md:grid-cols-2">
          <div className="panel p-5">
            <p className="eyebrow eyebrow-accent mb-2">// by city</p>
            <h3 className="display text-lg font-medium mb-4">IT jobs in top Indian cities</h3>
            <div className="flex flex-wrap gap-2">
              {CITIES.map((c) => (<Link key={c.href} href={c.href} className="chip chip-muted transition hover:opacity-80">{c.label}</Link>))}
              <Link href="/jobs-in" className="chip chip-indigo">All cities</Link>
            </div>
          </div>
          <div className="panel p-5">
            <p className="eyebrow eyebrow-accent mb-2">// by passout batch</p>
            <h3 className="display text-lg font-medium mb-4">Openings for your graduation year</h3>
            <div className="flex flex-wrap gap-2">
              {BATCHES.map((y) => (<Link key={y} href={`/batch/${y}`} className="chip chip-muted transition hover:opacity-80">{y} batch</Link>))}
              <Link href="/batch" className="chip chip-indigo">All batches</Link>
            </div>
          </div>
        </div>
      </ScrollReveal>

      {/* About, with its recording */}
      <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
        <hr className="hr-line mb-12" />
        <div className="grid items-center gap-8 lg:grid-cols-2 lg:gap-14">
          <div>
            <p className="eyebrow eyebrow-accent mb-2">// about InternFlow</p>
            <h2 className="display text-2xl font-medium sm:text-3xl">A job and internship search built for Indian freshers</h2>
            <div className="mt-5 space-y-4 text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-soft)' }}>
              <p>
                InternFlow collects <Link href="/jobs" className="underline">jobs</Link> and{' '}
                <Link href="/internships" className="underline">internships</Link> from company career pages and job boards, so you
                do not have to check dozens of sites. It is aimed at B.Tech, BCA, MCA, B.Sc and MBA students and recent graduates
                looking for their first role in software, data, AI, cloud or analytics.
              </p>
              <p>
                See <Link href="/companies" className="underline">which companies are hiring</Link>, filter by role, skill, city or
                passout batch, then use the <Link href="/resume/builder" className="underline">resume builder</Link>,{' '}
                <Link href="/ats-checker" className="underline">ATS checker</Link> and{' '}
                <Link href="/cover-letter" className="underline">cover letter generator</Link> before you apply. Our{' '}
                <Link href="/blog" className="underline">blog</Link> has interview preparation and resume guides.
              </p>
            </div>
            <Link href="/about" className="btn btn-secondary mt-6">More about us</Link>
          </div>
          <figure className="m-0">
            <VideoPlayer video={ABOUT_VIDEO} frame="browser" />
            <figcaption className="mt-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
              Companies hiring now, with every open role and the hiring process.
            </figcaption>
          </figure>
        </div>
      </ScrollReveal>

      {/* FAQ */}
      <ScrollReveal as="section" className="container-xl py-12 sm:py-16">
        <hr className="hr-line mb-12" />
        <SectionHead eyebrow="frequently asked" title="Fresher jobs in India: common questions" />
        <HomeFaq />
      </ScrollReveal>

      {/* CTA */}
      <ScrollReveal as="section" className="container-xl pb-16 sm:pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center sm:p-9">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>// ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Find your first IT job or internship today.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <MagneticLink href="/jobs" className="btn btn-primary flex-shrink-0 whitespace-nowrap">Browse jobs free</MagneticLink>
            <Link href="/ats-checker" className="btn btn-secondary flex-shrink-0 whitespace-nowrap">Check my resume</Link>
          </div>
        </div>
      </ScrollReveal>
    </>
  );
}

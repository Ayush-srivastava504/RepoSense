// Module: app/components/HomeHero.tsx
// Defines component(s)/export(s): HomeHero
// Large hero box (same aurora look as before, now bigger) with a laptop-style
// preview of the job board. Mobile-first: the mockup shrinks and drops its
// second card on small screens.

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuroraBackground from './AuroraBackground';
import MagneticLink from './MagneticLink';
import { canonicalPathForJob } from '@/lib/slug';

const DEGREES = ['B.Tech', 'BCA', 'MCA', 'B.Sc', 'MBA'];
const FILTERS = ['Freshers', 'Internship', 'Remote', 'Paid'];
const ROLES = [
  { href: '/careers/software-engineer', label: 'Software Engineer' },
  { href: '/careers/data-engineer', label: 'Data Engineer' },
  { href: '/careers/ai-ml-engineer', label: 'AI / ML Engineer' },
  { href: '/careers/devops-engineer', label: 'DevOps' },
  { href: '/careers/data-analyst', label: 'Data Analyst' },
];

function MockCard({ job }: { job: any }) {
  const pay = job.salary || job.stipend;
  return (
    <Link
      href={canonicalPathForJob(job)}
      className="flex min-w-0 flex-col justify-between rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md"
      style={{ background: 'var(--paper)', borderColor: 'var(--line-strong)' }}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-sm font-semibold"
          style={{ background: 'var(--indigo-soft)', color: 'var(--indigo)' }}
        >
          {String(job.company || '?').charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold" style={{ color: 'var(--ink)' }}>{job.title}</p>
          <p className="truncate text-xs" style={{ color: 'var(--ink-soft)' }}>{job.company}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {job.location && <span className="chip chip-muted text-[10px]">{job.location}</span>}
        {job.type && <span className="chip chip-muted text-[10px]">{job.type}</span>}
        {pay && <span className="chip chip-green text-[10px]">{pay}</span>}
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border p-3" style={{ background: 'var(--paper)', borderColor: 'var(--line-strong)' }} aria-hidden="true">
      <div className="flex gap-2.5">
        <div className="h-9 w-9 rounded-lg" style={{ background: 'var(--paper-dim)' }} />
        <div className="flex-1 space-y-1.5 pt-1">
          <div className="h-2.5 w-3/4 rounded" style={{ background: 'var(--paper-dim)' }} />
          <div className="h-2 w-1/2 rounded" style={{ background: 'var(--paper-dim)' }} />
        </div>
      </div>
      <div className="mt-4 h-2 w-2/3 rounded" style={{ background: 'var(--paper-dim)' }} />
    </div>
  );
}

export default function HomeHero({ previewJobs }: { previewJobs: any[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % DEGREES.length), 2200);
    return () => clearInterval(id);
  }, []);

  const cards = previewJobs.slice(0, 2);

  return (
    <section className="px-3 pb-6 sm:px-5 sm:pb-10">
      <div
        className="hero-reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl border"
        style={{ borderColor: 'var(--line-strong)', background: 'var(--paper-dim)' }}
      >
        <AuroraBackground particleCount={14} />

        <div className="relative z-10 flex flex-col items-center px-4 pt-10 text-center sm:px-8 sm:pt-16 md:pt-20">
          <p data-reveal="0" className="eyebrow eyebrow-accent mb-3">
            // jobs &amp; internships for Indian students
          </p>

          <h1 data-reveal="1" className="display max-w-4xl text-[2rem] font-semibold leading-[1.08] sm:text-5xl md:text-6xl">
            Jobs &amp; internships for
            <span className="mt-1 block" style={{ color: 'var(--indigo)' }}>
              <span key={i} className="word-in">{DEGREES[i]}</span> freshers in India
            </span>
          </h1>

          <p data-reveal="2" className="mt-5 max-w-2xl text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-soft)' }}>
            Software engineer, data engineer, AI/ML and IT jobs for B.Tech, BCA, MCA, B.Sc and MBA
            graduates — collected daily from company career pages, with a free ATS resume builder and
            cover letter tool to help you apply.
          </p>

          <form data-reveal="3" action="/jobs" method="get" role="search" className="mt-6 flex w-full max-w-xl flex-col gap-2 sm:flex-row">
            <input
              type="search"
              name="search"
              aria-label="Search jobs and internships"
              placeholder="Try “Software Engineer”, “Data Engineer”, “AI”…"
              className="min-h-[48px] w-full flex-1 rounded-lg border px-4 text-sm outline-none focus:ring-2"
              style={{ background: 'var(--paper)', borderColor: 'var(--line-strong)', color: 'var(--ink)' }}
            />
            <button type="submit" className="btn btn-primary min-h-[48px] justify-center">Search jobs</button>
          </form>

          <div data-reveal="4" className="mt-4 flex flex-wrap justify-center gap-2">
            {ROLES.map((r) => (
              <Link key={r.href} href={r.href} className="chip chip-muted transition hover:opacity-80">{r.label}</Link>
            ))}
          </div>

          <div data-reveal="4" className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <MagneticLink href="/internships" className="btn btn-secondary">Browse internships</MagneticLink>
            <Link href="/resume/builder" className="btn btn-secondary">Build my resume</Link>
          </div>
        </div>

        {/* Laptop preview — cropped at the bottom of the hero box */}
        <div className="relative z-10 mx-auto mt-10 w-full max-w-4xl px-4 sm:mt-14 sm:px-8">
          <div
            className="rounded-t-2xl border border-b-0 p-1.5 sm:rounded-t-3xl sm:p-3"
            style={{ background: 'var(--ink)', borderColor: 'var(--line-strong)' }}
          >
            <div className="overflow-hidden rounded-t-xl sm:rounded-t-2xl" style={{ background: 'var(--paper)' }}>
              <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5 sm:px-5 sm:py-3.5" style={{ borderColor: 'var(--line)' }}>
                <div className="text-left">
                  <p className="display text-sm font-semibold sm:text-base">Fresher Job Board</p>
                  <p className="hidden text-xs sm:block" style={{ color: 'var(--ink-soft)' }}>New roles from company career pages</p>
                </div>
                <span className="chip chip-green text-[10px]">Updated daily</span>
              </div>

              <div className="px-3 py-3 sm:px-5 sm:py-4">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-xs" style={{ borderColor: 'var(--line-strong)', color: 'var(--ink-soft)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
                  Search titles, companies or skills
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {FILTERS.map((f, idx) => (
                    <span key={f} className={`chip text-[11px] ${idx === 0 ? 'chip-active' : 'chip-muted'}`}>{f}</span>
                  ))}
                </div>

                <p className="mt-4 text-left text-xs font-semibold" style={{ color: 'var(--ink-soft)' }}>Fresh opportunities for you</p>
                <div className="mt-2 grid gap-3 pb-1 sm:grid-cols-2 sm:pb-6">
                  {cards.length > 0 ? (
                    cards.map((j, idx) => (
                      <div key={j.id} className={idx > 0 ? 'hidden sm:block' : ''}>
                        <MockCard job={j} />
                      </div>
                    ))
                  ) : (
                    <>
                      <SkeletonCard />
                      <div className="hidden sm:block"><SkeletonCard /></div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

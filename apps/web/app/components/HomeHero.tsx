// Module: app/components/HomeHero.tsx
// Defines component(s)/export(s): HomeHero
// Homepage hero: headline, job search and role shortcuts on the left; the main product video (a real
// recording of the live job search) on the right. Stacks on mobile with the video under the search box.

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import AuroraBackground from './AuroraBackground';
import MagneticLink from './MagneticLink';
import VideoPlayer from './VideoPlayer';
import { HERO_VIDEO } from '@/lib/toolVideos';

const DEGREES = ['B.Tech', 'BCA', 'MCA', 'B.Sc', 'MBA'];
const ROLES = [
  { href: '/careers/software-engineer', label: 'Software Engineer' },
  { href: '/careers/data-engineer', label: 'Data Engineer' },
  { href: '/careers/ai-ml-engineer', label: 'AI / ML' },
  { href: '/careers/devops-engineer', label: 'DevOps' },
  { href: '/careers/data-analyst', label: 'Data Analyst' },
];
const PROOF = [
  'New roles every day from company career pages',
  'Every tool is free, no account needed',
  'Made for B.Tech, BCA, MCA, B.Sc and MBA freshers',
];

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="mt-0.5 flex-none" style={{ color: 'var(--green)' }}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export default function HomeHero() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((v) => (v + 1) % DEGREES.length), 2200);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="px-3 pb-8 sm:px-5 sm:pb-12">
      <div
        className="hero-reveal relative mx-auto max-w-6xl overflow-hidden rounded-3xl border"
        style={{ borderColor: 'var(--line-strong)', background: 'var(--paper-dim)' }}
      >
        <AuroraBackground particleCount={14} />

        <div className="relative z-10 grid items-center gap-10 px-5 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:gap-12 lg:py-16">
          <div>
            <p data-reveal="0" className="eyebrow eyebrow-accent mb-3">
              // jobs &amp; internships for Indian students
            </p>

            <h1 data-reveal="1" className="display text-[2rem] font-semibold leading-[1.08] sm:text-5xl lg:text-[2.9rem]">
              {/* Keep the {' '}: the span is block-level, and without a real space the flattened text
                  reads "forB.Tech freshers" to crawlers and screen readers. */}
              Jobs &amp; internships for{' '}
              <span className="mt-1 block" style={{ color: 'var(--indigo)' }}>
                <span key={i} className="word-in">{DEGREES[i]}</span> freshers in India
              </span>
            </h1>

            <p data-reveal="2" className="mt-5 max-w-xl text-sm leading-relaxed sm:text-base" style={{ color: 'var(--ink-soft)' }}>
              Software engineer, data engineer, AI/ML and IT jobs for B.Tech, BCA, MCA, B.Sc and MBA
              graduates, collected daily from company career pages. Free resume, ATS and cover letter
              tools help you apply.
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

            <div data-reveal="4" className="mt-4 flex flex-wrap gap-2">
              {ROLES.map((r) => (
                <Link key={r.href} href={r.href} className="chip chip-muted transition hover:opacity-80">{r.label}</Link>
              ))}
            </div>

            <div data-reveal="4" className="mt-6 flex flex-wrap items-center gap-3">
              <MagneticLink href="/internships" className="btn btn-secondary">Browse internships</MagneticLink>
              <Link href="/resume/builder" className="btn btn-secondary">Build my resume</Link>
            </div>

            <ul data-reveal="4" className="mt-7 space-y-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {PROOF.map((p) => (
                <li key={p} className="flex gap-2"><Check />{p}</li>
              ))}
            </ul>
          </div>

          <figure data-reveal="3" className="m-0 w-full">
            <VideoPlayer video={HERO_VIDEO} frame="browser" priority />
            <figcaption className="mt-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
              The live job search: filter by role, city or batch and open any listing.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}

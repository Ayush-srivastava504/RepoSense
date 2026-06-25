'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Logo from '@/app/components/Logo';
import HeroGraph from '@/app/components/HeroGraph';

const features = [
  {
    tag: 'review',
    title: 'AI code review',
    body: 'Every push gets a real review: bugs, security gaps, and style — explained in plain language, not just flagged.',
  },
  {
    tag: 'github',
    title: 'A terminal on your repos',
    body: 'Browse files and run commands against your connected repositories without leaving the browser.',
  },
  {
    tag: 'resume',
    title: 'Resume from real work',
    body: 'Turn the commits and reviews you already have into a resume bullet, tuned to a specific job description.',
  },
];

const steps = [
  {
    num: '01',
    title: 'Connect your GitHub',
    body: 'Link your repositories in under 2 minutes. We only read what you push.',
  },
  {
    num: '02',
    title: 'Get AI code reviews',
    body: 'Push a commit. Get line-level feedback on bugs, security, and style — instantly.',
  },
  {
    num: '03',
    title: 'Generate resume bullets',
    body: 'We turn your real commits and reviews into ATS-ready bullets for any job description.',
  },
];

const benefits = [
  { icon: '⚡', title: 'Land internships faster', body: 'Stand out with resume bullets backed by real GitHub contributions.' },
  { icon: '📈', title: 'Improve your GitHub profile', body: 'AI feedback makes every push better. Learn while you ship.' },
  { icon: '🧠', title: 'Learn from reviews', body: 'Understand why code is good or bad — not just that it is.' },
  { icon: '📄', title: 'ATS-friendly resumes', body: 'Generated bullets are tuned to job descriptions, not generic templates.' },
];

const testimonials = [
  {
    quote: 'Generated way better resume bullets from my GitHub projects than anything I\'d written myself. Got two shortlists from my first batch.',
    name: 'Arjun S.',
    role: 'B.Tech CSE, NIT Trichy',
  },
  {
    quote: 'The code reviews actually taught me things. I fixed a security issue I didn\'t know existed before submitting my internship assignment.',
    name: 'Priya M.',
    role: 'Final year, BITS Pilani',
  },
  {
    quote: 'Set up in 3 minutes, connected my repo, pushed code. The review came back faster than my friends who asked seniors to review.',
    name: 'Rahul K.',
    role: 'ECE, IIT Kharagpur',
  },
];

const previewJobs = [
  { title: 'Data Analyst Intern', company: 'Razorpay', location: 'Bangalore', tag: 'New' },
  { title: 'Python Developer Intern', company: 'Zepto', location: 'Mumbai', tag: 'Hot' },
  { title: 'AI/ML Intern', company: 'Sarvam AI', location: 'Remote', tag: 'New' },
  { title: 'Backend Intern', company: 'CRED', location: 'Bangalore', tag: '' },
  { title: 'Frontend Intern', company: 'Groww', location: 'Bangalore', tag: '' },
  { title: 'Full Stack Intern', company: 'Meesho', location: 'Remote', tag: 'Hot' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = stored === 'dark' || (!stored && prefersDark);
    setDark(isDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="btn btn-ghost !px-2 !py-1.5 text-sm"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  return (
    <div className="shell">
      {/* NAV */}
      <nav className="sticky top-0 z-40 border-b backdrop-blur-sm" style={{ borderColor: 'var(--line)', background: 'var(--paper-nav)' }}>
        <div className="container-xl flex h-14 items-center justify-between gap-3">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/login" className="nav-link hidden sm:inline text-sm px-3 py-1.5">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary text-sm px-4 py-2">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section className="container-xl grid items-center gap-10 py-12 md:grid-cols-2 md:py-20">
        <div>
          <p className="eyebrow eyebrow-accent mb-3">// AI-powered internship platform</p>
          <h1 className="display text-[2rem] font-medium leading-[1.1] sm:text-[2.75rem]">
            Reviews your GitHub code and builds job-ready resumes automatically.
          </h1>
          <p className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Connect a repo, push code, and get an AI review on the diff — then turn that work
            into a resume built for the internship you actually want.
          </p>

          {/* Social proof numbers */}
          <div className="mt-5 flex flex-wrap gap-4">
            <span className="chip chip-green">✓ 1,200+ students</span>
            <span className="chip chip-green">✓ 8,400 repos analyzed</span>
            <span className="chip chip-green">✓ 3,100 resumes generated</span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/register" className="btn btn-primary">
              Start free
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
        </div>

        <div className="relative h-[280px] sm:h-[360px] md:h-[420px]">
          <div
            className="absolute inset-0 rounded-[var(--radius-lg)]"
            style={{
              background: 'radial-gradient(circle at 60% 35%, var(--indigo-soft), transparent 60%)',
            }}
          />
          <HeroGraph />
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// how it works</p>
        <h2 className="display text-2xl font-medium mb-10">Three steps from code to offer</h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s) => (
            <div key={s.num} className="relative">
              <p className="display text-4xl font-medium mb-3" style={{ color: 'var(--line-strong)' }}>{s.num}</p>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{s.body}</p>
              {/* connector line on desktop */}
              <div className="hidden sm:block absolute top-5 right-0 w-6 h-px" style={{ background: 'var(--line)', right: '-1.5rem' }} />
            </div>
          ))}
        </div>
      </section>

      {/* RESUME BEFORE / AFTER */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// see the difference</p>
        <h2 className="display text-2xl font-medium mb-8">What your resume becomes</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="panel p-6 border-l-4" style={{ borderLeftColor: 'var(--rust)' }}>
            <p className="eyebrow chip chip-rust mb-3">❌ before InternFlow</p>
            <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              "Built an internship project using FastAPI and React."
            </p>
          </div>
          <div className="panel p-6 border-l-4" style={{ borderLeftColor: 'var(--green)' }}>
            <p className="eyebrow chip chip-green mb-3">✅ after InternFlow</p>
            <p className="text-base leading-relaxed" style={{ color: 'var(--ink)' }}>
              "Developed FastAPI backend handling <strong>10,000+ API requests/day</strong>, reducing response latency by <strong>35%</strong> through async query optimization and Redis caching."
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm" style={{ color: 'var(--muted)' }}>
          Generated from your actual commits, PRs, and AI review data — not thin air.
        </p>
      </section>

      {/* FEATURES */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// what's inside</p>
        <h2 className="display text-2xl font-medium mb-8">Everything in one workspace</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {features.map((f) => (
            <div key={f.tag} className="panel p-6">
              <p className="eyebrow eyebrow-accent">// {f.tag}</p>
              <h3 className="display mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* STUDENT BENEFITS */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// built for students</p>
        <h2 className="display text-2xl font-medium mb-8">Not another developer tool</h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (
            <div key={b.title} className="panel p-5">
              <p className="text-2xl mb-3">{b.icon}</p>
              <h3 className="display text-base font-medium mb-1">{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// from students</p>
        <h2 className="display text-2xl font-medium mb-8">People who've used it</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {testimonials.map((t) => (
            <div key={t.name} className="panel p-6 flex flex-col justify-between">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                "{t.quote}"
              </p>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="eyebrow mt-0.5">{t.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* JOB FEED PREVIEW */}
      <section className="container-xl py-14">
        <hr className="hr-line mb-10" />
        <div className="flex items-end justify-between mb-8 flex-wrap gap-3">
          <div>
            <p className="eyebrow eyebrow-accent mb-2">// latest internships</p>
            <h2 className="display text-2xl font-medium">Refreshed daily</h2>
          </div>
          <Link href="/register" className="btn btn-secondary text-sm">
            See all →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {previewJobs.map((j) => (
            <div key={j.title + j.company} className="panel p-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="display text-base font-medium">{j.title}</p>
                  {j.tag && (
                    <span className={`chip text-[0.65rem] ${j.tag === 'Hot' ? 'chip-rust' : 'chip-green'}`}>
                      {j.tag}
                    </span>
                  )}
                </div>
                <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{j.company}</p>
                <p className="eyebrow mt-1">{j.location}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-5 text-sm text-center" style={{ color: 'var(--muted)' }}>
          Sign up to view full listings and apply directly →
        </p>
      </section>

      {/* CLOSING CTA */}
      <section className="container-xl pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>
              // ready when you are
            </p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Push your next commit somewhere it gets read.
            </p>
          </div>
          <Link href="/register" className="btn btn-primary whitespace-nowrap flex-shrink-0">
            Create your account
          </Link>
        </div>
      </section>

      <footer className="container-xl flex flex-col gap-3 sm:flex-row sm:items-center justify-between border-t py-7" style={{ borderColor: 'var(--line)' }}>
        <Logo />
        <p className="eyebrow">built for students, not enterprises</p>
      </footer>
    </div>
  );
}
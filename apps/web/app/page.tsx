'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Logo from './components/Logo';
import HeroGraph from './components/HeroGraph';

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
      <nav className="border-b" style={{ borderColor: 'var(--line)' }}>
        <div className="container-xl flex h-16 items-center justify-between">
          <Logo />
          <div className="flex items-center gap-3">
            <Link href="/login" className="nav-link">
              Sign in
            </Link>
            <Link href="/register" className="btn btn-primary text-sm">
              Get started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container-xl grid items-center gap-10 py-16 md:grid-cols-2 md:py-24">
        <div>
          <p className="eyebrow eyebrow-accent mb-4">// for students shipping real code</p>
          <h1 className="display text-4xl font-medium leading-[1.08] sm:text-5xl">
            Get reviewed like a senior engineer is watching your branch.
          </h1>
          <p className="mt-5 max-w-md text-[1.0625rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Connect a repo, push code, and get an AI review on the diff — then turn that work
            into a resume built for the internship you actually want.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link href="/register" className="btn btn-primary">
              Start free
            </Link>
            <Link href="/login" className="btn btn-secondary">
              Sign in
            </Link>
          </div>
          <div className="mt-10 flex gap-8 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
            <div>
              <p className="display text-2xl font-medium">2 min</p>
              <p className="eyebrow mt-1">to connect a repo</p>
            </div>
            <div>
              <p className="display text-2xl font-medium">3</p>
              <p className="eyebrow mt-1">tools, one workspace</p>
            </div>
          </div>
        </div>

        <div className="relative h-[320px] md:h-[420px]">
          <div
            className="absolute inset-0 rounded-[var(--radius-lg)]"
            style={{
              background: 'radial-gradient(circle at 60% 35%, var(--indigo-soft), transparent 60%)',
            }}
          />
          <HeroGraph />
        </div>
      </section>

      {/* Features as diff-styled panels */}
      <section className="container-xl py-16">
        <hr className="hr-line mb-12" />
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.tag} className="panel p-6">
              <p className="eyebrow eyebrow-accent">// {f.tag}</p>
              <h3 className="display mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-[0.9375rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="container-xl pb-24">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>
              // ready when you are
            </p>
            <p className="display mt-2 text-2xl font-medium text-white">
              Push your next commit somewhere it gets read.
            </p>
          </div>
          <Link href="/register" className="btn btn-primary whitespace-nowrap">
            Create your account
          </Link>
        </div>
      </section>

      <footer className="container-xl flex items-center justify-between border-t py-8" style={{ borderColor: 'var(--line)' }}>
        <Logo />
        <p className="eyebrow">built for students, not enterprises</p>
      </footer>
    </div>
  );
}
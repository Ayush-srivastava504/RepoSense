'use client';

import Link from 'next/link';
import AppShell from '@/app/components/AppShell';
import { useAuth } from '@/lib/auth';
import { trackEvent } from '@/lib/analytics';

const values = [
  {
    tag: 'why',
    title: 'Built by students, for students',
    body: 'We were tired of resumes full of vague bullet points and code reviews that only happen during a job interview. InternFlow turns the work you are already doing on GitHub into proof — and into a better resume.',
  },
  {
    tag: 'how',
    title: 'Real signal, not templates',
    body: 'Every resume bullet is generated from your actual commits, pull requests, and AI review history — never a generic template filled in with guesses.',
  },
  {
    tag: 'what',
    title: 'A full workspace, not a single tool',
    body: 'Code review, a connected GitHub workspace, a curated internship feed, and a resume builder — all reading from the same source of truth.',
  },
];

const stats = [
  { value: '1,200+', label: 'students' },
  { value: '8,400', label: 'repos analyzed' },
  { value: '3,100', label: 'resumes generated' },
];

const team = [
  { name: 'Product & Engineering', body: 'Small team, shipping weekly. We dogfood InternFlow on our own repos.' },
];

export default function AboutPage() {
  const { user, logout } = useAuth();
  const handleLogout = () => { trackEvent('logout'); logout(); };

  return (
    <AppShell user={user} onLogout={handleLogout}>
      <div>
        <p className="eyebrow eyebrow-accent">// about</p>
        <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">
          Why InternFlow exists
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          InternFlow connects to your GitHub, reviews your code like a senior engineer would,
          and turns that real work into a resume tuned for the internship you're applying to —
          all in one workspace.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        {stats.map((s) => (
          <div key={s.label} className="panel px-5 py-3">
            <p className="display text-xl font-medium">{s.value}</p>
            <p className="eyebrow mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-12">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// the mission</p>
        <h2 className="display text-xl font-medium mb-8">What we believe</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {values.map((v) => (
            <div key={v.tag} className="panel p-6">
              <p className="eyebrow eyebrow-accent">// {v.tag}</p>
              <h3 className="display mt-3 text-lg font-medium">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {v.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <hr className="hr-line mb-10" />
        <p className="eyebrow eyebrow-accent mb-2">// the team</p>
        <h2 className="display text-xl font-medium mb-6">Who's behind it</h2>
        <div className="grid gap-5 sm:grid-cols-2">
          {team.map((t) => (
            <div key={t.name} className="panel p-6">
              <p className="display text-base font-medium">{t.name}</p>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {t.body}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-12">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>// ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Connect a repo and see your first review in minutes.
            </p>
          </div>
          <Link href="/register" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
            Create your account
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

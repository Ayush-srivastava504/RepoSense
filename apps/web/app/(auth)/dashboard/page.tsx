'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import AppShell from '../../components/AppShell';

const tools = [
  {
    href: '/github',
    tag: '01',
    title: 'Code review',
    body: 'Connect a repo, browse files, and run an AI review on any diff.',
    chip: { label: 'connected', tone: 'chip-green' as const },
  },
  {
    href: '/jobs',
    tag: '02',
    title: 'Internships',
    body: 'A live feed of internship postings pulled from multiple sources.',
    chip: { label: 'updated daily', tone: 'chip-muted' as const },
  },
  {
    href: '/resume/builder',
    tag: '03',
    title: 'Resume builder',
    body: 'Write a resume by hand, or generate one from a job description.',
    chip: { label: 'premium', tone: 'chip-rust' as const },
  },
];

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <AppShell user={user} onLogout={logout}>
      <p className="eyebrow eyebrow-accent">// overview</p>
      <h1 className="display mt-2 text-3xl font-medium">
        {user?.email ? `Welcome back, ${user.email.split('@')[0]}` : 'Welcome back'}
      </h1>
      <p className="mt-2 max-w-lg" style={{ color: 'var(--ink-soft)' }}>
        Pick up where you left off, or jump into a tool below.
      </p>

      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {tools.map((t) => (
          <Link key={t.href} href={t.href} className="panel group block p-6 transition hover:-translate-y-0.5">
            <div className="flex items-center justify-between">
              <span className="eyebrow">{t.tag}</span>
              <span className={`chip ${t.chip.tone}`}>{t.chip.label}</span>
            </div>
            <h2 className="display mt-4 text-xl font-medium">{t.title}</h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {t.body}
            </p>
            <span
              className="mt-5 inline-flex items-center gap-1 text-sm font-semibold"
              style={{ color: 'var(--indigo)' }}
            >
              Open
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
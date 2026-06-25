'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../components/AppShell';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

interface Stats {
  total_reviews: number;
  resumes_generated: number;
  jobs_viewed: number;
  repos_connected: number;
  avg_quality_score: number | null;
  issues_found: number;
}

interface RecentReview {
  id: string;
  repo: string;
  file: string;
  score: number;
  issues: number;
  reviewed_at: string;
}

interface RecentResume {
  id: string;
  title: string;
  type: string;
  created_at: string;
}

interface ConnectedRepo {
  id: string;
  full_name: string;
  language: string | null;
  updated_at: string;
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: 'green' | 'indigo' | 'rust';
}) {
  const colorMap = {
    green: 'var(--green)',
    indigo: 'var(--indigo)',
    rust: 'var(--rust)',
  };
  return (
    <div className="panel p-5">
      <p className="eyebrow mb-3">{label}</p>
      <p
        className="display text-3xl font-medium tabular-nums"
        style={{ color: accent ? colorMap[accent] : 'var(--ink)' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
          {sub}
        </p>
      )}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 90 ? 'var(--green)'
    : score >= 75 ? '#ca8a04'
    : score >= 50 ? '#ea580c'
    : 'var(--rust)';
  return (
    <span
      className="tabular-nums text-sm font-semibold"
      style={{ color }}
    >
      {score}/100
    </span>
  );
}

function EmptyState({ label, cta, href }: { label: string; cta: string; href: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center rounded-[var(--radius-md)] border py-10 text-center"
      style={{ borderColor: 'var(--line)', borderStyle: 'dashed' }}
    >
      <p className="text-sm" style={{ color: 'var(--muted)' }}>{label}</p>
      <Link href={href} className="btn btn-secondary mt-4 text-sm">
        {cta}
      </Link>
    </div>
  );
}

function DashboardContent() {
  const { user, logout } = useAuth();

  const [stats, setStats] = useState<Stats | null>(null);
  const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
  const [recentResumes, setRecentResumes] = useState<RecentResume[]>([]);
  const [repos, setRepos] = useState<ConnectedRepo[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);

  useEffect(() => {
    trackEvent('dashboard_viewed', { user_email: user?.email });

    // Load stats
    api
      .get('/dashboard/stats')
      .then((data: Stats) => setStats(data))
      .catch(() => {
        // Graceful fallback — show zeros rather than crashing
        setStats({
          total_reviews: 0,
          resumes_generated: 0,
          jobs_viewed: 0,
          repos_connected: 0,
          avg_quality_score: null,
          issues_found: 0,
        });
      })
      .finally(() => setLoadingStats(false));

    // Load recent activity in parallel
    Promise.allSettled([
      api.get('/dashboard/recent-reviews?limit=5'),
      api.get('/dashboard/recent-resumes?limit=3'),
      api.get('/github/repos?limit=4'),
    ]).then(([reviewsRes, resumesRes, reposRes]) => {
      if (reviewsRes.status === 'fulfilled') setRecentReviews(reviewsRes.value ?? []);
      if (resumesRes.status === 'fulfilled') setRecentResumes(resumesRes.value ?? []);
      if (reposRes.status === 'fulfilled') setRepos((reposRes.value ?? []).slice(0, 4));
      setLoadingActivity(false);
    });
  }, [user]);

  const handleLogout = () => {
    trackEvent('logout');
    logout();
  };

  const firstName = user?.email?.split('@')[0] ?? 'there';

  return (
    <AppShell user={user} onLogout={handleLogout}>
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-accent">// overview</p>
          <h1 className="display mt-2 text-3xl font-medium">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Here's what's happening across your workspace.
          </p>
        </div>
        <Link href="/github" className="btn btn-primary text-sm">
          Open code review
        </Link>
      </div>

      {/* Stats */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {loadingStats ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="panel p-5 animate-pulse">
              <div className="h-3 w-24 rounded" style={{ background: 'var(--line)' }} />
              <div className="mt-4 h-8 w-16 rounded" style={{ background: 'var(--line)' }} />
            </div>
          ))
        ) : (
          <>
            <StatCard
              label="// code reviews"
              value={stats?.total_reviews ?? 0}
              sub={stats?.issues_found ? `${stats.issues_found} issues found` : 'No reviews yet'}
            />
            <StatCard
              label="// avg quality score"
              value={stats?.avg_quality_score != null ? `${stats.avg_quality_score}/100` : '—'}
              accent={
                stats?.avg_quality_score == null ? undefined
                : stats.avg_quality_score >= 80 ? 'green'
                : stats.avg_quality_score >= 60 ? 'indigo'
                : 'rust'
              }
              sub="across all reviewed files"
            />
            <StatCard
              label="// resumes generated"
              value={stats?.resumes_generated ?? 0}
              sub="AI-generated PDFs"
            />
            <StatCard
              label="// repos connected"
              value={stats?.repos_connected ?? 0}
              sub="GitHub repositories"
            />
          </>
        )}
      </div>

      {/* Quick actions */}
      <div className="mt-10">
        <p className="eyebrow mb-4">// quick actions</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link
            href="/github"
            className="panel p-5 flex flex-col gap-2 transition-shadow hover:shadow-md"
            onClick={() => trackEvent('dashboard_quick_action', { action: 'review' })}
          >
            <p className="eyebrow eyebrow-accent">// review</p>
            <p className="display text-base font-medium">Review a file</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Open a repo, pick a file, and get line-level AI feedback.
            </p>
          </Link>
          <Link
            href="/resume/builder"
            className="panel p-5 flex flex-col gap-2 transition-shadow hover:shadow-md"
            onClick={() => trackEvent('dashboard_quick_action', { action: 'resume' })}
          >
            <p className="eyebrow eyebrow-accent">// resume</p>
            <p className="display text-base font-medium">Generate resume</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Turn your commits and reviews into ATS-ready bullets.
            </p>
          </Link>
          <Link
            href="/jobs"
            className="panel p-5 flex flex-col gap-2 transition-shadow hover:shadow-md"
            onClick={() => trackEvent('dashboard_quick_action', { action: 'jobs' })}
          >
            <p className="eyebrow eyebrow-accent">// internships</p>
            <p className="display text-base font-medium">Browse listings</p>
            <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
              Daily-refreshed internship postings from multiple sources.
            </p>
          </Link>
        </div>
      </div>

      {/* Activity + repos */}
      <div className="mt-10 grid gap-6 lg:grid-cols-2">

        {/* Recent reviews */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">// recent reviews</p>
            <Link href="/github" className="btn btn-ghost text-xs !py-1 !px-2">
              View all
            </Link>
          </div>

          {loadingActivity ? (
            <div className="panel divide-y" style={{ borderColor: 'var(--line)' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 animate-pulse">
                  <div className="space-y-2">
                    <div className="h-3 w-40 rounded" style={{ background: 'var(--line)' }} />
                    <div className="h-3 w-24 rounded" style={{ background: 'var(--line)' }} />
                  </div>
                  <div className="h-4 w-12 rounded" style={{ background: 'var(--line)' }} />
                </div>
              ))}
            </div>
          ) : recentReviews.length === 0 ? (
            <EmptyState
              label="No reviews yet — open a file in GitHub to start."
              cta="Go to code review"
              href="/github"
            />
          ) : (
            <div className="panel divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
              {recentReviews.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={r.file}>
                      {r.file.split('/').pop()}
                    </p>
                    <p className="eyebrow mt-0.5 truncate" title={r.repo}>
                      {r.repo}
                    </p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                      {new Date(r.reviewed_at).toLocaleDateString()} ·{' '}
                      {r.issues} issue{r.issues !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ScoreBadge score={r.score} />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connected repos */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">// connected repos</p>
            <Link href="/github" className="btn btn-ghost text-xs !py-1 !px-2">
              Manage
            </Link>
          </div>

          {loadingActivity ? (
            <div className="panel divide-y" style={{ borderColor: 'var(--line)' }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 animate-pulse">
                  <div className="h-3 w-48 rounded" style={{ background: 'var(--line)' }} />
                  <div className="h-3 w-16 rounded" style={{ background: 'var(--line)' }} />
                </div>
              ))}
            </div>
          ) : repos.length === 0 ? (
            <EmptyState
              label="No repositories connected yet."
              cta="Connect GitHub"
              href="/github"
            />
          ) : (
            <div className="panel divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
              {repos.map((repo) => (
                <div key={repo.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={repo.full_name}>
                      {repo.full_name}
                    </p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--muted)' }}>
                      Updated {new Date(repo.updated_at).toLocaleDateString()}
                    </p>
                  </div>
                  {repo.language && (
                    <span className="chip chip-muted flex-shrink-0 text-[0.65rem]">
                      {repo.language}
                    </span>
                  )}
                </div>
              ))}
              {repos.length === 4 && (
                <div className="p-3 text-center">
                  <Link href="/github" className="text-xs" style={{ color: 'var(--indigo)' }}>
                    View all repositories
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Recent resumes */}
      {(recentResumes.length > 0 || !loadingActivity) && (
        <div className="mt-10">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">// recent resumes</p>
            <Link href="/resume/builder" className="btn btn-ghost text-xs !py-1 !px-2">
              Builder
            </Link>
          </div>

          {recentResumes.length === 0 ? (
            <EmptyState
              label="No resumes generated yet."
              cta="Generate resume"
              href="/resume/builder"
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-3">
              {recentResumes.map((r) => (
                <div key={r.id} className="panel p-5">
                  <p className="eyebrow eyebrow-accent">// {r.type || 'resume'}</p>
                  <p className="display mt-2 text-base font-medium truncate" title={r.title}>
                    {r.title || 'Untitled resume'}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>
                    {new Date(r.created_at).toLocaleDateString()}
                  </p>
                  <Link
                    href="/resume/builder"
                    className="btn btn-secondary mt-4 w-full text-xs"
                    onClick={() => trackEvent('dashboard_resume_regenerate', { id: r.id })}
                  >
                    Regenerate
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Getting started checklist — shown only until stats fill up */}
      {stats && stats.total_reviews === 0 && stats.repos_connected === 0 && (
        <div className="mt-10">
          <hr className="hr-line mb-8" />
          <p className="eyebrow eyebrow-accent mb-2">// getting started</p>
          <h2 className="display text-xl font-medium mb-6">Three things to do first</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '01',
                title: 'Connect GitHub',
                body: 'Link your account and pick a repository to analyse.',
                href: '/github',
                cta: 'Connect now',
                done: stats.repos_connected > 0,
              },
              {
                step: '02',
                title: 'Run a code review',
                body: 'Open any file and get line-level AI feedback.',
                href: '/github',
                cta: 'Review a file',
                done: stats.total_reviews > 0,
              },
              {
                step: '03',
                title: 'Generate your resume',
                body: 'Turn your commits into ATS-ready impact bullets.',
                href: '/resume/builder',
                cta: 'Build resume',
                done: stats.resumes_generated > 0,
              },
            ].map((item) => (
              <div
                key={item.step}
                className="panel p-5"
                style={item.done ? { opacity: 0.5 } : undefined}
              >
                <p
                  className="display text-3xl font-medium mb-3"
                  style={{ color: item.done ? 'var(--green)' : 'var(--line-strong)' }}
                >
                  {item.done ? 'done' : item.step}
                </p>
                <p className="display text-base font-medium">{item.title}</p>
                <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{item.body}</p>
                {!item.done && (
                  <Link href={item.href} className="btn btn-secondary mt-4 text-sm w-full">
                    {item.cta}
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}
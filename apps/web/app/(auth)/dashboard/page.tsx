// Module: app/(auth)/dashboard/page.tsx
// Dashboard: job search first, then the application pipeline (from the local tracker), what to do next,
// and the GitHub review / resume workspace underneath.

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { trackEvent } from '@/lib/analytics';
import { useTranslation } from '@/i18n/LanguageContext';
import { getTrackedJobs, subscribeTracker, daysUntilDeadline, type TrackedJob } from '@/lib/tracker';

interface Stats {
    total_reviews: number;
    resumes_generated: number;
    jobs_viewed: number;
    repos_connected: number;
    avg_quality_score: number | null;
    issues_found: number;
}
interface RecentReview { id: string; repo: string; file: string; score: number; issues: number; reviewed_at: string; }
interface RecentResume { id: string; title: string; type: string; created_at: string; }
interface ConnectedRepo { id: string; full_name: string; language: string | null; updated_at: string; }

const muted = { color: 'var(--muted)' } as const;
const soft = { color: 'var(--ink-soft)' } as const;

function scoreColor(score: number) {
    if (score >= 90) return 'var(--green)';
    if (score >= 75) return 'var(--score-amber, #b45309)';
    if (score >= 50) return 'var(--score-orange, #c2410c)';
    return 'var(--rust)';
}
function greeting() {
    const h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
}
function dueTone(days: number) {
    if (days <= 2) return 'var(--rust)';
    if (days <= 7) return 'var(--score-amber, #b45309)';
    return 'var(--ink-soft)';
}
function dueText(days: number) {
    return days === 0 ? 'Closes today' : `${days} day${days === 1 ? '' : 's'} left`;
}

function Chevron() {
    return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-shrink-0 transition-transform group-hover:translate-x-0.5" style={muted}>
      <polyline points="9 18 15 12 9 6"/>
    </svg>);
}

function SkeletonLines() {
    return (<div className="animate-pulse space-y-3" aria-hidden="true">
      {[0, 1, 2].map((i) => (<div key={i} className="space-y-2">
          <div className="h-3 w-3/4 rounded" style={{ background: 'var(--line)' }}/>
          <div className="h-3 w-1/2 rounded" style={{ background: 'var(--line)' }}/>
        </div>))}
    </div>);
}

function Column({ title, meta, href, linkLabel, loading, emptyText, emptyCta, children, }: {
    title: string;
    meta?: string;
    href: string;
    linkLabel: string;
    loading: boolean;
    emptyText: string;
    emptyCta: string;
    children: React.ReactNode[] | null;
}) {
    const empty = !children || children.length === 0;
    return (<section className="min-w-0 p-5">
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="display text-base font-medium">
          {title}
          {meta && <span className="ml-2 font-sans text-xs font-normal" style={muted}>{meta}</span>}
        </h3>
        <Link href={href} className="text-xs font-medium" style={{ color: 'var(--indigo)' }}>{linkLabel}</Link>
      </div>
      {loading ? <SkeletonLines/> : empty ? (<div>
          <p className="text-sm" style={soft}>{emptyText}</p>
          <Link href={href} className="btn btn-secondary mt-3 !px-3 !py-1.5 text-xs">{emptyCta}</Link>
        </div>) : (<ul className="divide-y" style={{ borderColor: 'var(--line)' }}>{children}</ul>)}
    </section>);
}

function Pipeline({ jobs }: { jobs: TrackedJob[] }) {
    const count = (s: TrackedJob['status']) => jobs.filter((j) => j.status === s).length;
    const stages = [
        { key: 'saved', label: 'Saved', color: 'var(--ink)' },
        { key: 'applied', label: 'Applied', color: 'var(--ink)' },
        { key: 'interviewing', label: 'Interviewing', color: 'var(--indigo)' },
        { key: 'offer', label: 'Offers', color: 'var(--green)' },
    ] as const;
    const closing = jobs
        .map((j) => ({ job: j, days: daysUntilDeadline(j.deadline) }))
        .filter((x): x is { job: TrackedJob; days: number } => x.days !== null && x.days >= 0 && x.days <= 14 && x.job.status !== 'rejected' && x.job.status !== 'offer')
        .sort((a, b) => a.days - b.days)
        .slice(0, 3);
    return (<section className="panel flex flex-col overflow-hidden">
      <div className="flex items-baseline justify-between gap-3 px-5 pt-5">
        <h2 className="display text-lg font-medium">Your applications</h2>
        <Link href="/tracker" className="text-xs font-medium" style={{ color: 'var(--indigo)' }}>Open tracker</Link>
      </div>
      <div className="mt-4 grid grid-cols-4 divide-x border-y" style={{ borderColor: 'var(--line)' }}>
        {stages.map((s) => (<Link key={s.key} href="/tracker" className="px-3 py-4 text-center transition-colors hover:bg-[var(--paper-dim)] sm:px-5 sm:text-left">
            <span className="display block text-3xl font-medium tabular-nums" style={{ color: count(s.key) > 0 ? s.color : 'var(--line-strong)' }}>{count(s.key)}</span>
            <span className="mt-0.5 block text-xs" style={soft}>{s.label}</span>
          </Link>))}
      </div>
      <div className="flex-1 p-5">
        {jobs.length === 0 ? (<>
            <p className="text-sm leading-relaxed" style={soft}>
              Nothing saved yet. Tap the bookmark on any listing and it lands here, with its deadline.
            </p>
            <Link href="/internships" className="btn btn-primary mt-4 text-sm">Find internships</Link>
          </>) : closing.length === 0 ? (<p className="text-sm" style={soft}>No deadlines in the next two weeks.</p>) : (<>
            <h3 className="mb-2 text-sm font-semibold">Closing soon</h3>
            <ul className="space-y-2">
              {closing.map(({ job, days }) => (<li key={job.jobId} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate">{job.title} <span style={muted}>at {job.company}</span></span>
                  <span className="flex-shrink-0 text-xs font-semibold tabular-nums" style={{ color: dueTone(days) }}>{dueText(days)}</span>
                </li>))}
            </ul>
          </>)}
      </div>
    </section>);
}

function DashboardContent() {
    const { user } = useAuth();
    const { t } = useTranslation();
    const router = useRouter();
    const [stats, setStats] = useState<Stats | null>(null);
    const [recentReviews, setRecentReviews] = useState<RecentReview[]>([]);
    const [recentResumes, setRecentResumes] = useState<RecentResume[]>([]);
    const [repos, setRepos] = useState<ConnectedRepo[]>([]);
    const [loadingActivity, setLoadingActivity] = useState(true);
    const [tracked, setTracked] = useState<TrackedJob[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setTracked(getTrackedJobs());
        return subscribeTracker(() => setTracked(getTrackedJobs()));
    }, []);

    useEffect(() => {
        trackEvent('dashboard_viewed', { user_email: user?.email });
        if (!user) {
            setLoadingActivity(false);
            return;
        }
        api.get('/dashboard/stats').then((data: Stats) => setStats(data)).catch(() => setStats(null));
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

    // Guest accounts have an auto-generated id as their email local-part (guest-6d40aad9...), which is not a name.
    const firstName = user?.is_guest ? 'there' : (user?.email?.split('@')[0] ?? 'there');
    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        trackEvent('dashboard_job_search', { query: searchQuery });
        const q = searchQuery.trim();
        router.push(q ? `/jobs?search=${encodeURIComponent(q)}` : '/jobs');
    };

    const nextSteps = [
        { action: 'jobs', href: '/internships', title: t('dashboard.actionJobsTitle', 'Browse listings'), body: t('dashboard.actionJobsBody', 'Daily-refreshed internship postings from multiple sources.') },
        { action: 'resume', href: '/resume/builder', title: t('dashboard.actionResumeTitle', 'Generate resume'), body: t('dashboard.actionResumeBody', 'Turn your commits and reviews into ATS-ready bullets.') },
        { action: 'ats', href: '/ats-checker', title: 'Check your resume against a job', body: 'See your ATS score and the keywords you are missing.' },
        { action: 'cover-letter', href: '/cover-letter', title: 'Write a cover letter', body: 'Get a first draft from your resume and the job description.' },
        { action: 'review', href: '/github', title: t('dashboard.actionReviewTitle', 'Review a file'), body: t('dashboard.actionReviewBody', 'Open a repo, pick a file, and get line-level AI feedback.') },
    ];

    return (<div className="mx-auto w-full max-w-5xl">
      <h1 className="display text-3xl font-medium [overflow-wrap:anywhere] sm:text-4xl">
        {user ? `${greeting()}, ${firstName}` : t('dashboard.greetingGuestTitle', 'Find your next internship')}
      </h1>
      <p className="mt-2 max-w-xl text-[0.95rem]" style={soft}>
        {user
            ? 'Pick up where you left off, or start a new search.'
            : t('dashboard.subtitleGuest', 'Search live listings right now — everything is open, no account needed.')}
      </p>

      <form onSubmit={handleSearch} className="panel mt-6 flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
        <label htmlFor="dash-search" className="sr-only">Search jobs and internships</label>
        <input id="dash-search" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t('dashboard.searchPlaceholder', 'Search internships by role, company, or skill…')} className="w-full flex-1 bg-transparent px-3 py-2.5 text-base outline-none" style={{ color: 'var(--ink)' }}/>
        <button type="submit" className="btn btn-primary min-h-[44px] w-full sm:w-auto">{t('dashboard.searchButton', 'Search jobs')}</button>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <span style={muted}>Popular:</span>
        {[['Software engineer', 'software engineer'], ['Data analyst', 'data analyst'], ['Remote', 'remote'], ['Marketing', 'marketing']].map(([label, q]) => (<Link key={q} href={`/jobs?search=${encodeURIComponent(q)}`} className="chip chip-muted !font-sans transition-colors hover:!bg-[var(--indigo-soft)] hover:!text-[var(--indigo)]">{label}</Link>))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Pipeline jobs={tracked}/>

        <section className="panel overflow-hidden">
          <h2 className="display px-5 pt-5 text-lg font-medium">What to do next</h2>
          <ul className="mt-3 divide-y border-t" style={{ borderColor: 'var(--line)' }}>
            {nextSteps.map((s) => (<li key={s.action}>
                <Link href={s.href} onClick={() => trackEvent('dashboard_quick_action', { action: s.action })} className="group flex min-h-[44px] items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--paper-dim)]">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">{s.title}</span>
                    <span className="mt-0.5 block text-sm leading-snug" style={soft}>{s.body}</span>
                  </span>
                  <Chevron/>
                </Link>
              </li>))}
          </ul>
        </section>
      </div>

      {user && (<section className="panel mt-6 overflow-hidden" aria-label="Your workspace">
          <div className="grid divide-y lg:grid-cols-3 lg:divide-x lg:divide-y-0" style={{ borderColor: 'var(--line)' }}>
            <Column title={t('dashboard.recentReviewsLabel', 'Code reviews')} meta={stats?.avg_quality_score != null ? `avg ${stats.avg_quality_score}/100` : undefined} href="/github" linkLabel={t('dashboard.viewAll', 'View all')} loading={loadingActivity} emptyText={t('dashboard.noReviewsYet', 'No reviews yet — open a file in GitHub to start.')} emptyCta={t('dashboard.goToCodeReview', 'Go to code review')}>
              {recentReviews.map((r) => (<li key={r.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={r.file}>{r.file.split('/').pop()}</p>
                    <p className="truncate text-xs" style={muted} title={r.repo}>{r.repo}</p>
                  </div>
                  <span className="flex-shrink-0 text-sm font-semibold tabular-nums" style={{ color: scoreColor(r.score) }}>{r.score}</span>
                </li>))}
            </Column>

            <Column title={t('dashboard.connectedReposLabel', 'Repositories')} meta={stats ? `${stats.repos_connected} connected` : undefined} href="/github" linkLabel={t('dashboard.manage', 'Manage')} loading={loadingActivity} emptyText={t('dashboard.noReposYet', 'No repositories connected yet.')} emptyCta={t('dashboard.connectGithub', 'Connect GitHub')}>
              {repos.map((repo) => (<li key={repo.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={repo.full_name}>{repo.full_name}</p>
                    <p className="text-xs" style={muted}>{t('dashboard.updatedPrefix', 'Updated')} {new Date(repo.updated_at).toLocaleDateString()}</p>
                  </div>
                  {repo.language && <span className="chip chip-muted flex-shrink-0 text-[0.65rem]">{repo.language}</span>}
                </li>))}
            </Column>

            <Column title={t('dashboard.recentResumesLabel', 'Resumes')} meta={stats ? `${stats.resumes_generated} generated` : undefined} href="/resume/builder" linkLabel={t('dashboard.builderLabel', 'Builder')} loading={loadingActivity} emptyText={t('dashboard.noResumesYet', 'No resumes generated yet.')} emptyCta={t('dashboard.generateResumeCta', 'Generate resume')}>
              {recentResumes.map((r) => (<li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium" title={r.title}>{r.title || t('dashboard.untitledResume', 'Untitled resume')}</p>
                    <p className="text-xs" style={muted}>{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                  <Link href="/resume/builder" onClick={() => trackEvent('dashboard_resume_regenerate', { id: r.id })} className="flex-shrink-0 text-xs font-medium" style={{ color: 'var(--indigo)' }}>
                    {t('dashboard.regenerate', 'Regenerate')}
                  </Link>
                </li>))}
            </Column>
          </div>
        </section>)}
    </div>);
}
export default function DashboardPage() {
    return <DashboardContent />;
}

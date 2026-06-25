'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../components/AppShell';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Issue {
  line: number;
  col?: number;
  severity: Severity;
  category: string;
  type: string;
  message: string;
  suggestion: string;
  confidence: number;
  snippet?: string;
  cwe?: string;
}

interface QualityMetrics {
  lines_of_code: number;
  total_issues: number;
  issue_density: number;
  severity_breakdown: Record<string, number>;
  category_breakdown: Record<string, number>;
  quality_score: number;
}

interface ReviewResult {
  issues: Issue[];
  quality_metrics: QualityMetrics;
  summary: string;
}

interface FixResult {
  success: boolean;
  fixed_code: string;
  fix_count: number;
  applied_fixes: { rule_type: string; line: number; description: string }[];
  skipped: { type: string; reason: string }[];
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'chip chip-rust',
  high:     'chip chip-rust',
  medium:   'chip chip-yellow',
  low:      'chip chip-blue',
  info:     'chip chip-muted',
};

const README_STATUS_STEPS = [
  { at: 0,    label: 'Reading repository structure…' },
  { at: 0.10, label: 'Scanning source files…' },
  { at: 0.22, label: 'Analysing code patterns…' },
  { at: 0.38, label: 'Identifying key modules…' },
  { at: 0.52, label: 'Drafting README sections…' },
  { at: 0.68, label: 'Writing usage examples…' },
  { at: 0.82, label: 'Polishing documentation…' },
  { at: 0.93, label: 'Almost done…' },
];

/** Logarithmic progress that never exceeds 95% until completion */
function calcProgress(elapsed: number, estimated: number) {
  const raw = elapsed / estimated;
  return Math.min(0.95, 1 - Math.exp(-raw * 2.8));
}

function ReadmeGenerateButton({
  onGenerate,
  disabled,
}: {
  onGenerate: () => Promise<void>;
  disabled?: boolean;
}) {
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt = useRef(0);
  const ESTIMATED_MS = 150_000; // 2.5 min

  const startTick = () => {
    startedAt.current = Date.now();
    setProgress(0);
    setStatusLabel(README_STATUS_STEPS[0].label);
    intervalRef.current = setInterval(() => {
      const p = calcProgress(Date.now() - startedAt.current, ESTIMATED_MS);
      setProgress(p);
      const step = [...README_STATUS_STEPS].reverse().find((s) => p >= s.at);
      if (step) setStatusLabel(step.label);
    }, 400);
  };

  const stopTick = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const handleClick = async () => {
    if (phase === 'running' || disabled) return;
    setPhase('running');
    setErrorMsg('');
    startTick();
    try {
      await onGenerate();
      stopTick();
      setProgress(1);
      setStatusLabel('Done!');
      setPhase('done');
    } catch (err: any) {
      stopTick();
      setPhase('error');
      setErrorMsg(err?.message || 'Generation failed. Please try again.');
    }
  };

  const pct = Math.round(progress * 100);

  return (
    <div className="flex flex-col gap-2" style={{ minWidth: 0 }}>
      <button
        onClick={handleClick}
        disabled={phase === 'running' || disabled}
        className={`btn btn-ghost${phase === 'running' ? ' btn-loading' : ''}`}
        aria-busy={phase === 'running'}
      >
        {phase === 'running' ? '\u00A0' : phase === 'done' ? '✓ README ready' : 'Generate README'}
      </button>

      {phase === 'running' && (
        <div className="gen-status" role="status" aria-live="polite">
          <span className="gen-label">Analysing repo · {pct}%</span>
          <div className="progress-bar-wrap" aria-hidden="true">
            <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <span style={{ fontSize: '0.8125rem' }}>{statusLabel}</span>
          <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>
            This usually takes 2–3 minutes — hang tight.
          </span>
        </div>
      )}

      {phase === 'idle' && !disabled && (
        <p className="text-xs" style={{ color: 'var(--muted)' }}>
          Analyses the full repo — typically 2–3 min.
        </p>
      )}

      {phase === 'error' && (
        <p className="chip chip-rust" style={{ fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }} role="alert">
          {errorMsg}
        </p>
      )}
    </div>
  );
}

function GitHubContent() {
  const { user, logout, refresh } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [repos, setRepos]                     = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo]       = useState('');
  const [files, setFiles]                     = useState<any[]>([]);
  const [currentPath, setCurrentPath]         = useState('');
  const [code, setCode]                       = useState('');
  const [review, setReview]                   = useState<ReviewResult | null>(null);
  const [fixResult, setFixResult]             = useState<FixResult | null>(null);
  const [loadingRepos, setLoadingRepos]       = useState(false);
  const [connected, setConnected]             = useState(false);
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [generatedReadme, setGeneratedReadme] = useState('');
  const [showReadme, setShowReadme]           = useState(false);
  const [reviewing, setReviewing]             = useState(false);
  const [fixing, setFixing]                   = useState(false);
  const [connectError, setConnectError]       = useState('');
  const readmeRef = useRef<HTMLDivElement>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  useEffect(() => { trackEvent('github_page_view'); }, []);

  // OAuth callback
  useEffect(() => {
    const urlCode  = searchParams.get('code');
    const urlError = searchParams.get('error');
    if (urlError) {
      setConnectError('GitHub connection was cancelled or failed. Please try again.');
      router.replace('/github');
      return;
    }
    if (!urlCode) return;
    router.replace('/github');
    setGithubConnecting(true);
    api
      .get(`/github/exchange?code=${urlCode}`)
      .then((data: { access_token: string }) => {
        localStorage.setItem('token', data.access_token);
        refresh();
        setConnected(true);
        trackEvent('github_connected', { email: user?.email });
      })
      .catch(() => setConnectError('Could not complete GitHub connection. Please try again.'))
      .finally(() => setGithubConnecting(false));
  }, [searchParams, router, refresh, user]);

  // Load repos
  useEffect(() => {
    if (!user) return;
    setLoadingRepos(true);
    api
      .get('/github/repos')
      .then((data) => { setRepos(data); setConnected(true); })
      .catch((err) => { if (err?.status === 401) setConnected(false); setRepos([]); })
      .finally(() => setLoadingRepos(false));
  }, [user]);

  // File tree
  useEffect(() => {
    if (!selectedRepo) return;
    api
      .get(`/github/contents?repo=${selectedRepo}&path=${currentPath}`)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [selectedRepo, currentPath]);

  // Actions
  const connectGitHub = () => {
    trackEvent('github_connect_clicked');
    setConnectError('');
    window.location.href = `${API_URL}/api/github/login`;
  };

  const disconnectGitHub = async () => {
    trackEvent('github_disconnected');
    try { await api.post('/github/disconnect', {}); } catch { /* best-effort */ }
    setConnected(false);
    setRepos([]);
    setSelectedRepo('');
    setFiles([]);
    setCode('');
    setReview(null);
    setFixResult(null);
    setGeneratedReadme('');
    setShowReadme(false);
  };

  const openFile = (file: any) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
    } else {
      trackEvent('file_opened', { repository: selectedRepo, file: file.path });
      api
        .get(`/github/file?repo=${selectedRepo}&path=${file.path}`)
        .then((res) => { setCode(res.content); setReview(null); setFixResult(null); })
        .catch(() => alert("Couldn't load that file. Try reconnecting GitHub."));
    }
  };

  const runReview = async () => {
    trackEvent('review_started', { repository: selectedRepo });
    setReviewing(true);
    setFixResult(null);
    try {
      const result = await api.post('/v1/review', { code, language: 'python' });
      setReview(result);
      trackEvent('review_completed', {
        repository: selectedRepo,
        score: result.quality_metrics.quality_score,
        issues: result.issues.length,
      });
    } catch (err: any) {
      alert(err?.message || 'Review failed. Please try again.');
    } finally {
      setReviewing(false);
    }
  };

  const runFix = async () => {
    if (!review) return;
    trackEvent('auto_fix_started');
    setFixing(true);
    try {
      const result: FixResult = await api.post('/v1/fix', {
        code,
        language: 'python',
        issues: review.issues,
      });
      setFixResult(result);
      if (result.success) {
        setCode(result.fixed_code);
        setReview(null);
        trackEvent('auto_fix_completed', { fixes: result.fix_count });
      }
    } catch (err: any) {
      alert(err?.message || 'Auto-fix failed. Please try again.');
    } finally {
      setFixing(false);
    }
  };

  const generateReadme = async () => {
    if (!selectedRepo) { alert('Select a repository first.'); return; }
    trackEvent('readme_generation_started', { repository: selectedRepo });
    const { job_id } = await api.post(`/github/${selectedRepo}/auto-setup`, {});
    const result = await api.pollJob(job_id, () => {});
    setGeneratedReadme(result.readme);
    setShowReadme(true);
    trackEvent('readme_generation_completed', { repository: selectedRepo });
    // Auto-scroll to README panel
    setTimeout(() => {
      readmeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 200);
  };

  const scoreColor = (score: number) =>
    score >= 90 ? 'var(--green)'
    : score >= 75 ? '#ca8a04'
    : score >= 50 ? '#ea580c'
    : 'var(--rust)';

  return (
    <AppShell user={user} onLogout={() => { trackEvent('logout'); logout(); }}>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow eyebrow-accent">// code review</p>
          <h1 className="display mt-2 text-3xl font-medium">GitHub</h1>
        </div>
        {connected && (
          <div className="flex items-center gap-3">
            <span className="chip chip-green">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }} />
              connected
            </span>
            <button onClick={disconnectGitHub} className="btn btn-ghost text-sm">
              Disconnect
            </button>
          </div>
        )}
      </div>

      {/* Connection error */}
      {connectError && (
        <p className="chip chip-rust mt-4 !inline-block !justify-start" role="alert">
          {connectError}
        </p>
      )}

      {githubConnecting ? (
        <div className="mt-12 flex flex-col items-center gap-4">
          <p className="eyebrow">completing GitHub connection…</p>
          <div className="progress-bar-wrap" style={{ maxWidth: '20rem' }}>
            <div className="progress-bar-fill" style={{ width: '60%', transition: 'none' }} />
          </div>
        </div>
      ) : !connected ? (
        <div className="panel mt-8 max-w-sm p-8">
          <p className="text-[0.9375rem]" style={{ color: 'var(--ink-soft)' }}>
            Connect a GitHub account to browse repositories and run reviews on real code.
          </p>
          <button onClick={connectGitHub} className="btn btn-primary mt-5 w-full sm:w-auto">
            Connect GitHub account
          </button>
        </div>
      ) : loadingRepos ? (
        <p className="mt-8 eyebrow">loading repositories…</p>
      ) : (
        <div className="mt-8 space-y-6">
          {/* Repo selector */}
          <select
            className="field"
            style={{ maxWidth: '28rem' }}
            onChange={(e) => {
              const repo = e.target.value;
              trackEvent('repository_selected', { repository: repo });
              setSelectedRepo(repo);
              setCurrentPath('');
              setCode('');
              setReview(null);
              setFixResult(null);
              setGeneratedReadme('');
              setShowReadme(false);
            }}
            defaultValue=""
          >
            <option value="" disabled>Select a repository</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
            ))}
          </select>

          {/* File browser + code preview */}
          {selectedRepo && (
            <div className="grid gap-4 md:grid-cols-2">
              {/* File tree */}
              <div className="panel overflow-hidden">
                <div className="border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
                  <p className="eyebrow">
                    files{currentPath ? ` / ${currentPath}` : ''}
                  </p>
                </div>
                <div className="h-72 overflow-auto p-2 sm:h-80">
                  {currentPath && (
                    <button
                      onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                      className="w-full rounded-[var(--radius-sm)] p-2 text-left text-sm"
                      style={{ color: 'var(--ink-soft)' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--paper-dim)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '')}
                    >
                      ← back
                    </button>
                  )}
                  {files.map((file) => (
                    <button
                      key={file.path}
                      onClick={() => openFile(file)}
                      className="block w-full rounded-[var(--radius-sm)] p-2 text-left text-sm"
                      style={{ color: 'var(--ink)' }}
                      onMouseOver={(e) => (e.currentTarget.style.background = 'var(--paper-dim)')}
                      onMouseOut={(e) => (e.currentTarget.style.background = '')}
                    >
                      <span aria-hidden="true" style={{ marginRight: '0.4rem' }}>
                        {file.type === 'dir' ? '📁' : '📄'}
                      </span>
                      {file.name}
                    </button>
                  ))}
                  {!files.length && (
                    <p className="p-2 text-sm" style={{ color: 'var(--muted)' }}>No files to show.</p>
                  )}
                </div>
              </div>

              {/* Code preview */}
              <div className="panel-dark overflow-hidden">
                <div className="border-b px-4 py-3" style={{ borderColor: '#2a2d35' }}>
                  <p className="eyebrow" style={{ color: '#9ea3ab' }}>preview</p>
                </div>
                <pre
                  className="h-72 overflow-auto p-4 text-[0.8125rem] leading-relaxed sm:h-80"
                  style={{ fontFamily: 'var(--font-mono)', color: '#d7d6cf' }}
                >
                  {code || '// select a file to preview it here'}
                </pre>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {selectedRepo && (
            <div className="flex flex-wrap items-start gap-3">
              <button
                onClick={runReview}
                disabled={!code || reviewing}
                className={`btn btn-primary${reviewing ? ' btn-loading' : ''}`}
                aria-busy={reviewing}
              >
                {reviewing ? '\u00A0' : 'Review this file'}
              </button>

              <button
                onClick={runFix}
                disabled={!review || fixing}
                className={`btn btn-secondary${fixing ? ' btn-loading' : ''}`}
                aria-busy={fixing}
              >
                {fixing ? '\u00A0' : 'Auto-fix issues'}
              </button>

              <ReadmeGenerateButton
                onGenerate={generateReadme}
                disabled={!selectedRepo}
              />
            </div>
          )}

          {/* Fix result banner */}
          {fixResult && (
            <div className="panel flex flex-wrap items-center gap-4 p-4">
              <span className={fixResult.success ? 'chip chip-green' : 'chip chip-rust'}>
                {fixResult.success
                  ? `${fixResult.fix_count} fix${fixResult.fix_count !== 1 ? 'es' : ''} applied`
                  : 'Nothing fixed'}
              </span>
              {fixResult.skipped.length > 0 && (
                <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {fixResult.skipped.length} skipped
                </span>
              )}
              {fixResult.success && (
                <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                  Preview updated — re-run Review to check remaining issues.
                </span>
              )}
            </div>
          )}

          {/* Review result */}
          {review && (
            <div className="panel p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <p className="eyebrow eyebrow-accent">// review result</p>
                <div className="flex items-center gap-3">
                  <span className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                    {review.summary}
                  </span>
                  <span
                    className="text-2xl font-bold tabular-nums"
                    style={{ color: scoreColor(review.quality_metrics.quality_score) }}
                  >
                    {review.quality_metrics.quality_score}
                    <span className="text-sm font-normal" style={{ color: 'var(--ink-soft)' }}>/100</span>
                  </span>
                </div>
              </div>

              {/* Severity breakdown */}
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(review.quality_metrics.severity_breakdown).map(([sev, count]) => (
                  <span key={sev} className={SEVERITY_STYLES[sev as Severity] ?? 'chip chip-muted'}>
                    {count} {sev}
                  </span>
                ))}
                <span className="chip chip-muted">{review.quality_metrics.lines_of_code} lines</span>
                <span className="chip chip-muted">density {review.quality_metrics.issue_density}</span>
              </div>

              {/* Issues */}
              <div className="flex flex-col gap-3">
                {review.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius-sm)] p-3"
                    style={{ background: 'var(--paper-dim)' }}
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className={SEVERITY_STYLES[issue.severity] ?? 'chip chip-muted'}>
                        {issue.severity}
                      </span>
                      <span className="chip chip-muted">{issue.category}</span>
                      {issue.cwe && (
                        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>{issue.cwe}</span>
                      )}
                      <span className="ml-auto text-xs" style={{ color: 'var(--muted)' }}>
                        line {issue.line}{issue.col ? `:${issue.col}` : ''} · {Math.round(issue.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm font-medium">{issue.message}</p>
                    <p className="mt-0.5 text-sm" style={{ color: 'var(--ink-soft)' }}>{issue.suggestion}</p>
                    {issue.snippet && (
                      <pre
                        className="mt-2 overflow-auto rounded p-2 text-xs"
                        style={{ background: 'var(--paper)', fontFamily: 'var(--font-mono)', color: 'var(--ink-soft)' }}
                      >
                        {issue.snippet}
                      </pre>
                    )}
                  </div>
                ))}
                {review.issues.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--green)' }}>No issues found. Code looks clean ✓</p>
                )}
              </div>
            </div>
          )}

          {/* Generated README — scroll target */}
          {showReadme && generatedReadme && (
            <div className="panel p-5" ref={readmeRef} id="readme-output">
              <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
                <p className="eyebrow eyebrow-accent">// generated readme</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => navigator.clipboard.writeText(generatedReadme)}
                    className="btn btn-secondary text-xs !py-1 !px-3"
                  >
                    Copy
                  </button>
                  <button
                    onClick={() => setShowReadme(false)}
                    className="btn btn-ghost text-xs !py-1 !px-3"
                  >
                    Close
                  </button>
                </div>
              </div>
              <pre
                className="max-h-[30rem] overflow-auto rounded p-4 text-[0.875rem] leading-relaxed"
                style={{
                  background: 'var(--paper-dim)',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--ink-soft)',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {generatedReadme}
              </pre>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}

export default function GitHubPage() {
  return (
    <AuthGuard>
      <GitHubContent />
    </AuthGuard>
  );
}
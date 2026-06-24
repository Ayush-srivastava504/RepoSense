'use client';
import { useEffect, useState } from 'react';
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
  info:     'chip',
};

function GitHubContent() {
  const { user, logout, refresh } = useAuth();
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [repos, setRepos]                       = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo]         = useState('');
  const [files, setFiles]                       = useState<any[]>([]);
  const [currentPath, setCurrentPath]           = useState('');
  const [code, setCode]                         = useState('');
  const [review, setReview]                     = useState<ReviewResult | null>(null);
  const [fixResult, setFixResult]               = useState<FixResult | null>(null);
  const [loadingRepos, setLoadingRepos]         = useState(false);
  const [connected, setConnected]               = useState(false);
  const [githubConnecting, setGithubConnecting] = useState(false);
  const [generatedReadme, setGeneratedReadme]   = useState('');
  const [isGenerating, setIsGenerating]         = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');
  const [showReadme, setShowReadme]             = useState(false);
  const [reviewing, setReviewing]               = useState(false);
  const [fixing, setFixing]                     = useState(false);
  const [connectError, setConnectError]         = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL;

  // ── Track page visit ──────────────────────────────────────────────────────
  useEffect(() => {
    trackEvent('github_page_view');
  }, []);

  // ── OAuth callback ────────────────────────────────────────────────────────
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
        trackEvent('github_connected', {
          email: user?.email,
        });
      })
      .catch(() => setConnectError('Could not complete GitHub connection. Please try again.'))
      .finally(() => setGithubConnecting(false));
  }, [searchParams, router, refresh, user]);

  // ── Load repos on login ───────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    setLoadingRepos(true);
    api
      .get('/github/repos')
      .then((data) => { setRepos(data); setConnected(true); })
      .catch((err) => { if (err?.status === 401) setConnected(false); setRepos([]); })
      .finally(() => setLoadingRepos(false));
  }, [user]);

  // ── Load file tree on repo / path change ──────────────────────────────────
  useEffect(() => {
    if (!selectedRepo) return;
    api
      .get(`/github/contents?repo=${selectedRepo}&path=${currentPath}`)
      .then(setFiles)
      .catch(() => setFiles([]));
  }, [selectedRepo, currentPath]);

  // ── Actions ───────────────────────────────────────────────────────────────

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
  };

  const openFile = (file: any) => {
    if (file.type === 'dir') {
      setCurrentPath(file.path);
    } else {
      trackEvent('file_opened', {
        repository: selectedRepo,
        file: file.path,
      });
      api
        .get(`/github/file?repo=${selectedRepo}&path=${file.path}`)
        .then((res) => {
          setCode(res.content);
          setReview(null);
          setFixResult(null);
        })
        .catch(() => alert("Couldn't load that file. Try reconnecting GitHub."));
    }
  };

  const runReview = async () => {
    trackEvent('review_started', {
      repository: selectedRepo,
    });
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
        trackEvent('auto_fix_completed', {
          fixes: result.fix_count,
        });
      }
    } catch (err: any) {
      alert(err?.message || 'Auto-fix failed. Please try again.');
    } finally {
      setFixing(false);
    }
  };

  const generateReadme = async () => {
    if (!selectedRepo) { alert('Select a repository first.'); return; }
    trackEvent('readme_generation_started', {
      repository: selectedRepo,
    });
    setIsGenerating(true);
    setGeneratingStatus('Starting…');
    try {
      const { job_id } = await api.post(`/github/${selectedRepo}/auto-setup`, {});
      const result = await api.pollJob(job_id, (status: string) => {
        setGeneratingStatus(status === 'running' ? 'Generating README…' : status);
      });
      setGeneratedReadme(result.readme);
      setShowReadme(true);
      trackEvent('readme_generation_completed', {
        repository: selectedRepo,
      });
    } catch (error: any) {
      alert(error?.message || "Couldn't generate the README. Try again.");
    } finally {
      setIsGenerating(false);
      setGeneratingStatus('');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const scoreColor = (score: number) =>
    score >= 90 ? 'var(--green)'
    : score >= 75 ? 'var(--yellow)'
    : score >= 50 ? 'var(--orange)'
    : 'var(--rust)';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <AppShell
      user={user}
      onLogout={() => {
        trackEvent('logout');
        logout();
      }}
    >

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow eyebrow-accent">// code review</p>
          <h1 className="display mt-2 text-3xl font-medium">GitHub</h1>
        </div>
        <div className="flex items-center gap-3">
          {connected && (
            <>
              <span className="chip chip-green">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: 'var(--green)' }} />
                connected
              </span>
              <button onClick={disconnectGitHub} className="btn btn-ghost text-sm">
                Disconnect
              </button>
            </>
          )}
        </div>
      </div>

      {/* Connection error */}
      {connectError && (
        <p className="chip chip-rust mt-4 !inline-block !justify-start" role="alert">
          {connectError}
        </p>
      )}

      {githubConnecting ? (
        <p className="mt-8 eyebrow">completing GitHub connection...</p>

      ) : !connected ? (
        <div className="panel mt-8 max-w-md p-8">
          <p className="text-[0.9375rem]" style={{ color: 'var(--ink-soft)' }}>
            Connect a GitHub account to browse repositories and run reviews on real code.
          </p>
          <button onClick={connectGitHub} className="btn btn-primary mt-5">
            Connect GitHub account
          </button>
        </div>

      ) : loadingRepos ? (
        <p className="mt-8 eyebrow">loading repositories...</p>

      ) : (
        <div className="mt-8">

          {/* Repo selector */}
          <select
            className="field max-w-md"
            onChange={(e) => {
              const repo = e.target.value;
              trackEvent('repository_selected', {
                repository: repo,
              });
              setSelectedRepo(repo);
              setCurrentPath('');
              setCode('');
              setReview(null);
              setFixResult(null);
            }}
            defaultValue=""
          >
            <option value="" disabled>Select a repository</option>
            {repos.map((repo) => (
              <option key={repo.id} value={repo.full_name}>{repo.full_name}</option>
            ))}
          </select>

          {/* File browser + code preview */}
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="panel">
              <div className="border-b px-4 py-3" style={{ borderColor: 'var(--line)' }}>
                <p className="eyebrow">files {currentPath ? `/ ${currentPath}` : ''}</p>
              </div>
              <div className="h-80 overflow-auto p-2">
                {currentPath && (
                  <button
                    onClick={() => setCurrentPath(currentPath.split('/').slice(0, -1).join('/'))}
                    className="w-full rounded-[var(--radius-sm)] p-2 text-left text-sm hover:bg-[var(--paper-dim)]"
                  >
                    .. back
                  </button>
                )}
                {files.map((file) => (
                  <button
                    key={file.path}
                    onClick={() => openFile(file)}
                    className="block w-full rounded-[var(--radius-sm)] p-2 text-left text-sm hover:bg-[var(--paper-dim)]"
                  >
                    {file.type === 'dir' ? '📁 ' : '📄 '}{file.name}
                  </button>
                ))}
                {!files.length && (
                  <p className="p-2 text-sm" style={{ color: 'var(--muted)' }}>No files to show.</p>
                )}
              </div>
            </div>

            <div className="panel-dark overflow-hidden">
              <div className="border-b px-4 py-3" style={{ borderColor: '#2a2d35' }}>
                <p className="eyebrow" style={{ color: '#9ea3ab' }}>preview</p>
              </div>
              <pre
                className="h-80 overflow-auto p-4 text-[0.8125rem] leading-relaxed"
                style={{ fontFamily: 'var(--font-mono)', color: '#d7d6cf' }}
              >
                {code || '// select a file to preview it here'}
              </pre>
            </div>
          </div>

          {/* Action buttons */}
          <div className="mt-6 flex flex-wrap gap-3">
            <button onClick={runReview} disabled={!code || reviewing} className="btn btn-primary">
              {reviewing ? 'Reviewing...' : 'Review this file'}
            </button>
            <button onClick={runFix} disabled={!review || fixing} className="btn btn-secondary">
              {fixing ? 'Fixing...' : 'Auto-fix issues'}
            </button>
            <button
              onClick={generateReadme}
              disabled={isGenerating || !selectedRepo}
              className="btn btn-ghost"
            >
              {isGenerating ? generatingStatus || 'Generating README...' : 'Generate README'}
            </button>
          </div>

          {/* README timing hint */}
          {!isGenerating && (
            <p className="mt-2 text-xs" style={{ color: 'var(--ink-soft)' }}>
              README generation analyses your entire repository and typically takes 2–3 minutes.
            </p>
          )}

          {/* Fix result banner */}
          {fixResult && (
            <div className="panel mt-4 p-4 flex flex-wrap items-center gap-4">
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
            <div className="panel mt-6 p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
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

              {/* Severity breakdown pills */}
              <div className="mb-4 flex flex-wrap gap-2">
                {Object.entries(review.quality_metrics.severity_breakdown).map(([sev, count]) => (
                  <span key={sev} className={SEVERITY_STYLES[sev as Severity] ?? 'chip'}>
                    {count} {sev}
                  </span>
                ))}
                <span className="chip" style={{ color: 'var(--ink-soft)' }}>
                  {review.quality_metrics.lines_of_code} lines
                </span>
                <span className="chip" style={{ color: 'var(--ink-soft)' }}>
                  density {review.quality_metrics.issue_density}
                </span>
              </div>

              {/* Issue list */}
              <div className="flex flex-col gap-3">
                {review.issues.map((issue, i) => (
                  <div
                    key={i}
                    className="rounded-[var(--radius-sm)] p-3"
                    style={{ background: 'var(--paper-dim)' }}
                  >
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className={SEVERITY_STYLES[issue.severity] ?? 'chip'}>
                        {issue.severity}
                      </span>
                      <span className="chip">{issue.category}</span>
                      {issue.cwe && (
                        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
                          {issue.cwe}
                        </span>
                      )}
                      <span className="text-xs ml-auto" style={{ color: 'var(--ink-soft)' }}>
                        line {issue.line}{issue.col ? `:${issue.col}` : ''}
                        {' · '}
                        {Math.round(issue.confidence * 100)}% confidence
                      </span>
                    </div>
                    <p className="text-sm font-medium">{issue.message}</p>
                    <p className="text-sm mt-0.5" style={{ color: 'var(--ink-soft)' }}>
                      {issue.suggestion}
                    </p>
                    {issue.snippet && (
                      <pre
                        className="mt-2 text-xs overflow-auto rounded p-2"
                        style={{ background: 'var(--paper)', fontFamily: 'var(--font-mono)', color: '#d7d6cf' }}
                      >
                        {issue.snippet}
                      </pre>
                    )}
                  </div>
                ))}
                {review.issues.length === 0 && (
                  <p className="text-sm" style={{ color: 'var(--green)' }}>
                    No issues found. Code looks clean ✓
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Generated README */}
          {showReadme && generatedReadme && (
            <div className="panel mt-6 p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="eyebrow eyebrow-accent">// generated readme</p>
                <button onClick={() => setShowReadme(false)} className="btn btn-ghost !px-2 !py-1 text-sm">
                  Close
                </button>
              </div>
              <pre
                className="max-h-96 overflow-auto whitespace-pre-wrap text-[0.875rem] leading-relaxed"
                style={{ color: 'var(--ink-soft)' }}
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
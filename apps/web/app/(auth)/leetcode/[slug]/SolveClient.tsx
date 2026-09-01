// Module: app/(auth)/leetcode/[slug]/SolveClient.tsx
// Defines component(s)/export(s): SolvePageContent, SolveClient
// Defines function(s): difficultyColor, markSolved
// Defines type(s): ProblemDetail, TestResult, JudgeResponse

'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthGuard from '../../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';
interface ProblemDetail {
    slug: string;
    title: string;
    difficulty: string;
    description: string;
    function_name: string;
    starter_code: string;
}
interface TestResult {
    input: any;
    expected: any;
    actual: any;
    passed: boolean;
    error?: string | null;
}
interface JudgeResponse {
    ok: boolean;
    all_passed: boolean;
    summary?: string | null;
    error?: string | null;
    results: TestResult[];
}
function difficultyColor(d: string) {
    if (d === 'Easy')
        return 'var(--green)';
    if (d === 'Hard')
        return 'var(--rust)';
    return 'var(--score-amber)';
}
function markSolved(slug: string) {
    if (typeof window === 'undefined')
        return;
    for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (!key || !key.startsWith('leetcode-progress-'))
            continue;
        try {
            const raw = window.localStorage.getItem(key);
            const arr: string[] = raw ? JSON.parse(raw) : [];
            if (!arr.includes(slug)) {
                arr.push(slug);
                window.localStorage.setItem(key, JSON.stringify(arr));
            }
        }
        catch {
        }
    }
}
function SolvePageContent() {
    useAuth();
    const params = useParams<{
        slug: string;
    }>();
    const router = useRouter();
    const slug = params.slug;
    const [problem, setProblem] = useState<ProblemDetail | null>(null);
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState('');
    const [verdict, setVerdict] = useState<JudgeResponse | null>(null);
    const [notes, setNotes] = useState('');
    const [notesSaved, setNotesSaved] = useState(false);
    const [mobileTab, setMobileTab] = useState<'problem' | 'code' | 'notes'>('problem');
    useEffect(() => {
        let cancelled = false;
        (async () => {
            setLoading(true);
            setError('');
            setVerdict(null);
            try {
                const data: ProblemDetail = await api.get(`/leetcode/problems/${slug}`);
                if (cancelled)
                    return;
                setProblem(data);
                setCode(data.starter_code);
            }
            catch (e: any) {
                if (!cancelled) {
                    setError(e?.status === 404
                        ? "This problem doesn't have an in-app judge yet — try it on LeetCode directly."
                        : e?.message || 'Could not load this problem.');
                }
            }
            finally {
                if (!cancelled)
                    setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [slug]);
    useEffect(() => {
        if (typeof window === 'undefined')
            return;
        const raw = window.localStorage.getItem(`leetcode-notes-${slug}`);
        setNotes(raw || '');
    }, [slug]);
    function saveNotes(value: string) {
        setNotes(value);
        if (typeof window === 'undefined')
            return;
        window.localStorage.setItem(`leetcode-notes-${slug}`, value);
        setNotesSaved(true);
        window.setTimeout(() => setNotesSaved(false), 1200);
    }
    async function runTests() {
        if (!problem)
            return;
        setRunning(true);
        setVerdict(null);
        setError('');
        try {
            const result: JudgeResponse = await api.post(`/leetcode/problems/${slug}/submit`, { code });
            setVerdict(result);
            trackEvent('leetcode_submit', { slug, all_passed: result.all_passed });
            if (result.all_passed) {
                markSolved(slug);
            }
        }
        catch (e: any) {
            setError(e?.message || 'Could not run your solution. Try again in a moment.');
        }
        finally {
            setRunning(false);
        }
    }
    if (loading) {
        return (<div className="container-xl py-12">
        <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>Loading problem…</p>
      </div>);
    }
    if (!problem) {
        return (<div className="container-xl py-12">
        <p className="eyebrow eyebrow-accent mb-3">// leetcode</p>
        <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          No in-app judge for this problem yet
        </h1>
        {error && (<p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>{error}</p>)}
        <button onClick={() => router.push('/leetcode')} className="btn btn-secondary mt-6">
          Back to problem list
        </button>
      </div>);
    }

    const MOBILE_TABS = [
      { id: 'problem' as const, label: 'Problem' },
      { id: 'code' as const, label: 'Code' },
      { id: 'notes' as const, label: 'Notes' },
    ];

    return (<div className="container-xl py-6 sm:py-12">
      <Link href="/leetcode" className="text-xs" style={{ color: 'var(--ink-soft)' }}>
        &larr; All problems
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-xl sm:text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          {problem.title}
        </h1>
        <span className="text-sm font-medium" style={{ color: difficultyColor(problem.difficulty) }}>
          {problem.difficulty}
        </span>
      </div>

      {/* Mobile tab strip */}
      <div className="mt-5 flex gap-1 border-b lg:hidden" style={{ borderColor: 'var(--line)' }}>
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setMobileTab(tab.id)}
            className="px-4 py-2 text-sm font-medium transition-colors"
            style={{
              color: mobileTab === tab.id ? 'var(--indigo)' : 'var(--ink-soft)',
              borderBottom: mobileTab === tab.id ? '2px solid var(--indigo)' : '2px solid transparent',
              marginBottom: '-1px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Desktop: 2-column grid */}
      <div className="mt-6 lg:mt-8 hidden lg:grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Left: description + notes */}
        <div>
          <p className="field-label">Description</p>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {problem.description}
          </p>
          <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
            Implement <code className="font-mono">{problem.function_name}</code> below. Tests run
            server-side against a few fixed cases — no imports, no I/O, just the function body.
          </p>

          <div className="mt-8">
            <div className="flex items-center justify-between">
              <p className="field-label">Your notes</p>
              {notesSaved && (<span className="text-[11px]" style={{ color: 'var(--green)' }}>Saved</span>)}
            </div>
            <textarea value={notes} onChange={(e) => saveNotes(e.target.value)} placeholder="Approach, complexity, gotchas — kept only in this browser." rows={6} className="field mt-2 text-xs leading-relaxed"/>
          </div>
        </div>

        {/* Right: code editor */}
        <div>
          <p className="field-label">Your solution</p>
          <textarea value={code} onChange={(e) => setCode(e.target.value)} spellCheck={false} rows={16} className="field font-mono text-xs leading-relaxed" style={{ tabSize: 4 }}/>

          {error && (<p className="mt-2 text-xs" style={{ color: 'var(--rust)' }} role="alert">{error}</p>)}

          <button onClick={runTests} disabled={running} className="btn btn-primary mt-3 w-full sm:w-auto">
            {running ? 'Running…' : 'Run tests'}
          </button>

          {verdict && (<div className="mt-5 space-y-3">
              <div className="rounded-[var(--radius-md)] border p-4" style={{
                borderColor: verdict.all_passed ? 'var(--green)' : 'var(--line)',
            }}>
                <p className="text-sm font-medium" style={{ color: verdict.all_passed ? 'var(--green)' : 'var(--rust)' }}>
                  {verdict.ok
                ? verdict.summary || (verdict.all_passed ? 'All tests passed' : 'Some tests failed')
                : 'Could not run your code'}
                </p>
                {verdict.error && (<pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs" style={{ color: 'var(--ink-soft)' }}>
                    {verdict.error}
                  </pre>)}
              </div>

              {verdict.results.length > 0 && (<div className="space-y-2">
                  {verdict.results.map((r, i) => (<div key={i} className="rounded-[var(--radius-sm)] border p-3 text-xs" style={{ borderColor: 'var(--line)' }}>
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Test case {i + 1}</span>
                        <span style={{ color: r.passed ? 'var(--green)' : 'var(--rust)' }}>
                          {r.passed ? 'Pass' : 'Fail'}
                        </span>
                      </div>
                      <p className="mt-1" style={{ color: 'var(--ink-soft)' }}>
                        input: {JSON.stringify(r.input)} — expected: {JSON.stringify(r.expected)}
                        {!r.passed && ` — got: ${JSON.stringify(r.actual)}`}
                      </p>
                      {r.error && (<p className="mt-1" style={{ color: 'var(--rust)' }}>{r.error}</p>)}
                    </div>))}
                </div>)}
            </div>)}
        </div>
      </div>

      {/* Mobile: tab panels */}
      <div className="mt-4 lg:hidden">
        {mobileTab === 'problem' && (
          <div>
            <p className="field-label">Description</p>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {problem.description}
            </p>
            <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
              Implement <code className="font-mono">{problem.function_name}</code> below. Tests run
              server-side against a few fixed cases — no imports, no I/O, just the function body.
            </p>
            <button
              onClick={() => setMobileTab('code')}
              className="btn btn-primary mt-6 w-full"
            >
              Go to Code Editor →
            </button>
          </div>
        )}

        {mobileTab === 'code' && (
          <div>
            <p className="field-label">Your solution</p>
            <textarea
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              rows={16}
              className="field font-mono text-xs leading-relaxed"
              style={{ tabSize: 4 }}
            />
            {error && (<p className="mt-2 text-xs" style={{ color: 'var(--rust)' }} role="alert">{error}</p>)}
            <button onClick={runTests} disabled={running} className="btn btn-primary mt-3 w-full">
              {running ? 'Running…' : 'Run tests'}
            </button>

            {verdict && (<div className="mt-5 space-y-3">
                <div className="rounded-[var(--radius-md)] border p-4" style={{
                  borderColor: verdict.all_passed ? 'var(--green)' : 'var(--line)',
              }}>
                  <p className="text-sm font-medium" style={{ color: verdict.all_passed ? 'var(--green)' : 'var(--rust)' }}>
                    {verdict.ok
                  ? verdict.summary || (verdict.all_passed ? 'All tests passed' : 'Some tests failed')
                  : 'Could not run your code'}
                  </p>
                  {verdict.error && (<pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-xs" style={{ color: 'var(--ink-soft)' }}>
                      {verdict.error}
                    </pre>)}
                </div>
                {verdict.results.length > 0 && (<div className="space-y-2">
                    {verdict.results.map((r, i) => (<div key={i} className="rounded-[var(--radius-sm)] border p-3 text-xs" style={{ borderColor: 'var(--line)' }}>
                        <div className="flex items-center justify-between">
                          <span className="font-medium">Test case {i + 1}</span>
                          <span style={{ color: r.passed ? 'var(--green)' : 'var(--rust)' }}>
                            {r.passed ? 'Pass' : 'Fail'}
                          </span>
                        </div>
                        <p className="mt-1" style={{ color: 'var(--ink-soft)' }}>
                          input: {JSON.stringify(r.input)} — expected: {JSON.stringify(r.expected)}
                          {!r.passed && ` — got: ${JSON.stringify(r.actual)}`}
                        </p>
                        {r.error && (<p className="mt-1" style={{ color: 'var(--rust)' }}>{r.error}</p>)}
                      </div>))}
                  </div>)}
              </div>)}
          </div>
        )}

        {mobileTab === 'notes' && (
          <div>
            <div className="flex items-center justify-between">
              <p className="field-label">Your notes</p>
              {notesSaved && (<span className="text-[11px]" style={{ color: 'var(--green)' }}>Saved</span>)}
            </div>
            <textarea
              value={notes}
              onChange={(e) => saveNotes(e.target.value)}
              placeholder="Approach, complexity, gotchas — kept only in this browser."
              rows={12}
              className="field mt-2 text-xs leading-relaxed"
            />
          </div>
        )}
      </div>
    </div>);
}
export default function SolveClient() {
    return (<AuthGuard>
      <SolvePageContent />
    </AuthGuard>);
}

  

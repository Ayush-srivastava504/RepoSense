// Module: app/(auth)/ats-checker/page.tsx
// Defines component(s)/export(s): ROLES, AtsCheckerContent, AtsCheckerPage
// Defines function(s): scoreColor
// Defines type(s): CheckItem, CheckResult

'use client';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';
const ROLES = [
    { id: 'software_engineer', label: 'Software Engineer' },
    { id: 'ai_engineer', label: 'AI/ML Engineer' },
    { id: 'devops_engineer', label: 'DevOps Engineer' },
    { id: 'data_engineer', label: 'Data Engineer' },
    { id: 'data_analyst', label: 'Data Analyst' },
];
interface CheckItem {
    id: string;
    label: string;
    weight: number;
    passed: boolean;
    detail: string;
    tip: string;
    matched?: string[];
    missing?: string[];
}
interface CheckResult {
    role_label: string;
    score: number;
    max_score: number;
    word_count: number;
    checks: CheckItem[];
    matched_keywords: string[];
    missing_keywords: string[];
}
function scoreColor(score: number) {
    if (score >= 75)
        return 'var(--green)';
    if (score >= 50)
        return 'var(--score-amber)';
    return 'var(--rust)';
}
function AtsCheckerContent() {
    useAuth();
    const [role, setRole] = useState(ROLES[0].id);
    const [resumeText, setResumeText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState<CheckResult | null>(null);
    async function runCheck() {
        if (resumeText.trim().length < 40) {
            setError('Paste your full resume text first — a few words is not enough to score.');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);
        try {
            const data = await api.post('/ats/check', { resume_text: resumeText, role });
            setResult(data);
            trackEvent('ats_check_run', { role, score: data.score });
        }
        catch (e: any) {
            setError(e?.message || 'Could not score your resume. Try again in a moment.');
        }
        finally {
            setLoading(false);
        }
    }
    return (<div>
      <div className="max-w-2xl">
        <p className="eyebrow eyebrow-accent mb-3">// ats resume checker</p>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          Check your resume like an ATS would
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Pick the role you're applying for, paste your resume text, and get a scored breakdown —
          formatting issues, missing keywords, and what to fix first.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
          <div>
            <label className="field-label">Target role</label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className="field">
              {ROLES.map((r) => (<option key={r.id} value={r.id}>{r.label}</option>))}
            </select>
          </div>

          <div>
            <label className="field-label">Resume text</label>
            <textarea value={resumeText} onChange={(e) => setResumeText(e.target.value)} placeholder="Paste your resume text here (copy from your PDF/Word doc)…" rows={16} className="field font-mono text-xs leading-relaxed"/>
          </div>

          {error && (<p style={{ color: 'var(--rust)', fontSize: '0.8125rem' }} role="alert">{error}</p>)}

          <button onClick={runCheck} disabled={loading} className="btn btn-primary">
            {loading ? 'Scoring…' : 'Check my resume'}
          </button>
        </div>

        <div>
          {!result && (<div className="rounded-[var(--radius-md)] border p-6 text-sm" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
              Your score and a rule-by-rule breakdown will show up here once you run a check.
            </div>)}

          {result && (<div className="space-y-5">
              <div className="rounded-[var(--radius-md)] border p-5" style={{ borderColor: 'var(--line)' }}>
                <p className="eyebrow mb-1">{result.role_label}</p>
                <p className="text-4xl font-semibold" style={{ color: scoreColor(result.score), fontFamily: 'var(--font-display)' }}>
                  {result.score}<span className="text-lg" style={{ color: 'var(--ink-soft)' }}>/{result.max_score}</span>
                </p>
                <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>{result.word_count} words</p>
              </div>

              <div className="space-y-3">
                {result.checks.map((c) => (<div key={c.id} className="rounded-[var(--radius-sm)] border p-3" style={{ borderColor: 'var(--line)' }}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">{c.label}</p>
                      <span style={{ color: c.passed ? 'var(--green)' : 'var(--rust)', fontSize: '0.75rem' }}>
                        {c.passed ? 'Pass' : 'Needs work'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>{c.detail}</p>
                    {!c.passed && (<p className="mt-1 text-xs" style={{ color: 'var(--ink)' }}>Tip: {c.tip}</p>)}
                  </div>))}
              </div>

              {result.missing_keywords.length > 0 && (<div>
                  <p className="field-label">Missing keywords for this role</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.missing_keywords.map((k) => (<span key={k} className="rounded-full border px-2 py-1 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                        {k}
                      </span>))}
                  </div>
                </div>)}
            </div>)}
        </div>
      </div>
    </div>);
}
export default function AtsCheckerPage() {
    return (<AuthGuard>
      <AtsCheckerContent />
    </AuthGuard>);
}

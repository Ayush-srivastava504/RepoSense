'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../components/AppShell';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

interface ExperienceEntry { title: string; company: string; bullets: string[]; }
interface EducationEntry  { institution: string; degree: string; }

interface Status {
  tier: string;
  is_pro: boolean;
  free_limit: number;
  free_used: number;
  free_remaining: number;
  ad_credits: number;
  can_analyze: boolean;
}

interface RuleResult {
  id: string;
  label: string;
  category: string;
  weight: number;
  passed: boolean;
  detail: string;
  tip: string;
}

interface AnalysisResult {
  analysis_id: string;
  unlock_method: string;
  score: number;
  tier: string;
  passed_count: number;
  total_rules: number;
  rules: RuleResult[];
  ai_feedback: {
    overall_feedback: string;
    headline_rewrite: string;
    about_rewrite: string;
    priority_tips: string[];
  };
}

interface HistoryEntry {
  id: string;
  score: number;
  unlock_method: string;
  created_at: string;
}

function emptyExperience(): ExperienceEntry { return { title: '', company: '', bullets: [''] }; }
function emptyEducation(): EducationEntry { return { institution: '', degree: '' }; }

function scoreColor(score: number) {
  if (score >= 85) return 'var(--green)';
  if (score >= 65) return 'var(--indigo)';
  if (score >= 40) return 'var(--score-orange, #c2410c)';
  return 'var(--rust)';
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function LinkedInContent() {
  const { user, logout } = useAuth();

  const [status, setStatus]   = useState<Status | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // form state
  const [headline, setHeadline]   = useState('');
  const [about, setAbout]         = useState('');
  const [currentTitle, setCurrentTitle]     = useState('');
  const [currentCompany, setCurrentCompany] = useState('');
  const [hasPhoto, setHasPhoto]   = useState(false);
  const [hasBanner, setHasBanner] = useState(false);
  const [customUrl, setCustomUrl] = useState(false);
  const [skills, setSkills]       = useState('');
  const [certifications, setCertifications] = useState('');
  const [projects, setProjects]   = useState('');
  const [featuredItems, setFeaturedItems] = useState(0);
  const [recommendations, setRecommendations] = useState(0);
  const [experience, setExperience] = useState<ExperienceEntry[]>([emptyExperience()]);
  const [education, setEducation]   = useState<EducationEntry[]>([emptyEducation()]);

  // analysis state
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError]         = useState('');
  const [result, setResult]       = useState<AnalysisResult | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent('linkedin_page_viewed', { user_email: user?.email });
    api.get('/linkedin/status').then(setStatus).catch(() => setStatus(null)).finally(() => setLoadingStatus(false));
    api.get('/linkedin/history').then(setHistory).catch(() => setHistory([]));
  }, [user]);

  const updateExp = (i: number, field: keyof ExperienceEntry, value: string) =>
    setExperience((p) => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  const updateExpBullet = (ei: number, bi: number, v: string) =>
    setExperience((p) => p.map((e, idx) => {
      if (idx !== ei) return e;
      const b = [...e.bullets]; b[bi] = v; return { ...e, bullets: b };
    }));
  const addExpBullet = (i: number) =>
    setExperience((p) => p.map((e, idx) => idx === i ? { ...e, bullets: [...e.bullets, ''] } : e));
  const removeExp = (i: number) => setExperience((p) => p.filter((_, idx) => idx !== i));

  const updateEdu = (i: number, field: keyof EducationEntry, value: string) =>
    setEducation((p) => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  const removeEdu = (i: number) => setEducation((p) => p.filter((_, idx) => idx !== i));

  const refreshStatus = () => api.get('/linkedin/status').then(setStatus).catch(() => {});

  const watchAd = async () => {
    setUnlocking(true);
    trackEvent('linkedin_ad_unlock_started');
    try {
      // In production this kicks off a real rewarded-ad SDK flow and only
      // calls /unlock/ad from the ad network's server-side callback once
      // the ad is verified as fully watched.
      await api.post('/linkedin/unlock/ad', {});
      await refreshStatus();
      trackEvent('linkedin_ad_unlock_success');
    } catch (err: any) {
      setError(err?.message || 'Could not unlock — try again.');
    } finally {
      setUnlocking(false);
    }
  };

  const analyze = async () => {
    setAnalyzing(true);
    setError('');
    setResult(null);
    trackEvent('linkedin_analysis_started');
    try {
      const payload = {
        headline,
        about,
        current_title: currentTitle,
        current_company: currentCompany,
        has_photo: hasPhoto,
        has_banner: hasBanner,
        custom_url: customUrl,
        experience: experience
          .filter((e) => e.title || e.company)
          .map((e) => ({ title: e.title, company: e.company, bullets: e.bullets.filter((b) => b.trim()) })),
        education: education.filter((e) => e.institution || e.degree),
        skills: skills.split(',').map((s) => s.trim()).filter(Boolean),
        certifications: certifications.split(',').map((s) => s.trim()).filter(Boolean),
        projects: projects.split(',').map((s) => s.trim()).filter(Boolean),
        featured_items: featuredItems,
        recommendations_received: recommendations,
      };

      const { job_id } = await api.post('/linkedin/analyze', payload);
      const data = await api.pollJob(job_id, () => {});
      setResult(data);
      await refreshStatus();
      api.get('/linkedin/history').then(setHistory).catch(() => {});
      trackEvent('linkedin_analysis_success', { score: data?.score });
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err: any) {
      if (err?.status === 402) {
        setError(err?.message || "You've used your free check. Upgrade or watch an ad to unlock another one.");
      } else {
        setError(err?.message || "Couldn't run the analysis. Try again.");
      }
      trackEvent('linkedin_analysis_error', { error: err?.message });
    } finally {
      setAnalyzing(false);
    }
  };

  const gated = !loadingStatus && status && !status.can_analyze;

  return (
    <AppShell user={user} onLogout={() => { trackEvent('logout'); logout(); }}>
      <p className="eyebrow eyebrow-accent">// linkedin</p>
      <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">LinkedIn Profile Optimizer</h1>
      <p className="mt-1 max-w-xl text-sm" style={{ color: 'var(--ink-soft)' }}>
        Score your profile against 14 recruiter-relevant checks, then get an AI-rewritten headline,
        about section, and a prioritized list of fixes.
      </p>

      {/* ── Quota banner ── */}
      {!loadingStatus && status && (
        <div className="panel mt-6 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow eyebrow-accent">// access</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
              {status.is_pro
                ? 'Pro plan — unlimited LinkedIn analyses.'
                : status.free_remaining > 0
                ? `${status.free_remaining} free analysis remaining.`
                : status.ad_credits > 0
                ? `${status.ad_credits} unlocked credit available.`
                : "You've used your free analysis."}
            </p>
          </div>
          {!status.is_pro && status.free_remaining === 0 && status.ad_credits === 0 && (
            <div className="flex flex-wrap gap-2">
              <button onClick={watchAd} disabled={unlocking} className="btn btn-secondary text-sm">
                {unlocking ? 'Unlocking…' : 'Watch an ad for 1 more'}
              </button>
              <Link href="/#pricing" className="btn btn-primary text-sm">Upgrade to Pro</Link>
            </div>
          )}
        </div>
      )}

      {/* ── Form ── */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-8">
          <div className="panel p-6 space-y-4">
            <p className="eyebrow eyebrow-accent">// headline & about</p>
            <Field label="Headline">
              <input
                className="field"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Backend Engineer | Python & Go | Building fintech APIs at scale"
              />
            </Field>
            <Field label="About section">
              <textarea
                className="field min-h-[120px]"
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                placeholder="What you do, the impact you've had, and what you're looking for next…"
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Current title">
                <input className="field" value={currentTitle} onChange={(e) => setCurrentTitle(e.target.value)} />
              </Field>
              <Field label="Current company">
                <input className="field" value={currentCompany} onChange={(e) => setCurrentCompany(e.target.value)} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-5 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasPhoto} onChange={(e) => setHasPhoto(e.target.checked)} />
                Has profile photo
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={hasBanner} onChange={(e) => setHasBanner(e.target.checked)} />
                Has custom banner
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={customUrl} onChange={(e) => setCustomUrl(e.target.checked)} />
                Custom profile URL
              </label>
            </div>
          </div>

          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow eyebrow-accent">// experience</p>
              <button onClick={() => setExperience((p) => [...p, emptyExperience()])} className="btn btn-ghost !py-1 text-xs">
                + Add
              </button>
            </div>
            {experience.map((e, i) => (
              <div key={i} className="space-y-3 rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--line)' }}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input className="field" placeholder="Title" value={e.title} onChange={(ev) => updateExp(i, 'title', ev.target.value)} />
                  <input className="field" placeholder="Company" value={e.company} onChange={(ev) => updateExp(i, 'company', ev.target.value)} />
                </div>
                <div className="space-y-2">
                  {e.bullets.map((b, bi) => (
                    <input
                      key={bi}
                      className="field"
                      placeholder="Achievement bullet"
                      value={b}
                      onChange={(ev) => updateExpBullet(i, bi, ev.target.value)}
                    />
                  ))}
                  <button onClick={() => addExpBullet(i)} className="text-xs" style={{ color: 'var(--indigo)' }}>
                    + Add bullet
                  </button>
                </div>
                {experience.length > 1 && (
                  <button onClick={() => removeExp(i)} className="text-xs" style={{ color: 'var(--rust)' }}>Remove</button>
                )}
              </div>
            ))}
          </div>

          <div className="panel p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="eyebrow eyebrow-accent">// education</p>
              <button onClick={() => setEducation((p) => [...p, emptyEducation()])} className="btn btn-ghost !py-1 text-xs">
                + Add
              </button>
            </div>
            {education.map((e, i) => (
              <div key={i} className="grid gap-3 sm:grid-cols-2">
                <input className="field" placeholder="Institution" value={e.institution} onChange={(ev) => updateEdu(i, 'institution', ev.target.value)} />
                <div className="flex gap-2">
                  <input className="field" placeholder="Degree" value={e.degree} onChange={(ev) => updateEdu(i, 'degree', ev.target.value)} />
                  {education.length > 1 && (
                    <button onClick={() => removeEdu(i)} className="text-xs flex-shrink-0" style={{ color: 'var(--rust)' }}>Remove</button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="panel p-6 space-y-4">
            <p className="eyebrow eyebrow-accent">// skills & credibility</p>
            <Field label="Skills (comma separated)">
              <input className="field" value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="Python, React, PostgreSQL, AWS" />
            </Field>
            <Field label="Certifications (comma separated)">
              <input className="field" value={certifications} onChange={(e) => setCertifications(e.target.value)} />
            </Field>
            <Field label="Projects (comma separated)">
              <input className="field" value={projects} onChange={(e) => setProjects(e.target.value)} />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Featured items">
                <input type="number" min={0} className="field" value={featuredItems} onChange={(e) => setFeaturedItems(Number(e.target.value) || 0)} />
              </Field>
              <Field label="Recommendations received">
                <input type="number" min={0} className="field" value={recommendations} onChange={(e) => setRecommendations(Number(e.target.value) || 0)} />
              </Field>
            </div>
          </div>

          {error && (
            <div className="panel p-4 text-sm" style={{ borderColor: 'var(--rust)', color: 'var(--rust)' }}>
              {error}
            </div>
          )}

          <button
            onClick={analyze}
            disabled={analyzing || (!!status && !status.can_analyze)}
            className="btn btn-primary w-full sm:w-auto"
          >
            {analyzing ? 'Analyzing…' : gated ? 'Unlock to analyze' : 'Analyze my profile'}
          </button>
        </div>

        {/* ── History sidebar ── */}
        <div>
          <p className="eyebrow eyebrow-accent mb-3">// past analyses</p>
          {history.length === 0 ? (
            <div
              className="rounded-[var(--radius-md)] border border-dashed p-6 text-center text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
            >
              No analyses yet.
            </div>
          ) : (
            <div className="panel divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium" style={{ color: scoreColor(h.score) }}>{h.score}/100</p>
                    <p className="eyebrow mt-0.5">{new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className="chip chip-muted text-[0.65rem]">{h.unlock_method}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Result ── */}
      {result && (
        <div ref={resultRef} className="mt-12">
          <hr className="hr-line mb-8" />
          <div className="flex flex-wrap items-center gap-4">
            <p className="display text-4xl font-medium" style={{ color: scoreColor(result.score) }}>
              {result.score}/100
            </p>
            <div>
              <p className="display text-lg font-medium">{result.tier}</p>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {result.passed_count}/{result.total_rules} checks passed
              </p>
            </div>
          </div>

          {result.ai_feedback?.overall_feedback && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {result.ai_feedback.overall_feedback}
            </p>
          )}

          {(result.ai_feedback?.headline_rewrite || result.ai_feedback?.about_rewrite) && (
            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {result.ai_feedback.headline_rewrite && (
                <div className="panel p-5">
                  <p className="chip chip-green mb-3" style={{ width: 'fit-content' }}>suggested headline</p>
                  <p className="text-sm leading-relaxed">{result.ai_feedback.headline_rewrite}</p>
                </div>
              )}
              {result.ai_feedback.about_rewrite && (
                <div className="panel p-5">
                  <p className="chip chip-green mb-3" style={{ width: 'fit-content' }}>suggested about opener</p>
                  <p className="text-sm leading-relaxed">{result.ai_feedback.about_rewrite}</p>
                </div>
              )}
            </div>
          )}

          {result.ai_feedback?.priority_tips?.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow eyebrow-accent mb-3">// priority fixes</p>
              <ol className="space-y-2">
                {result.ai_feedback.priority_tips.map((tip, i) => (
                  <li key={i} className="panel p-4 text-sm leading-relaxed">
                    <span className="font-semibold mr-2">{i + 1}.</span>{tip}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <div className="mt-8">
            <p className="eyebrow eyebrow-accent mb-3">// full rule breakdown</p>
            <div className="panel divide-y overflow-hidden" style={{ borderColor: 'var(--line)' }}>
              {result.rules.map((r) => (
                <div key={r.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-soft)' }}>{r.detail}</p>
                    {!r.passed && (
                      <p className="mt-1 text-xs" style={{ color: 'var(--muted)' }}>{r.tip}</p>
                    )}
                  </div>
                  <span
                    className="flex-shrink-0 text-xs font-semibold"
                    style={{ color: r.passed ? 'var(--green)' : 'var(--rust)' }}
                  >
                    {r.passed ? 'Pass' : 'Fix'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function LinkedInPage() {
  return (
    <AuthGuard>
      <LinkedInContent />
    </AuthGuard>
  );
}

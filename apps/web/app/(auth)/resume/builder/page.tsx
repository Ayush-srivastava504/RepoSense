'use client';

import { useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../../components/AppShell';
import AuthGuard from '../../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

type Tab = 'handwritten' | 'ai';

interface ExperienceEntry  { company: string; role: string; start: string; end: string; bullets: string[]; }
interface EducationEntry   { institution: string; degree: string; year: string; }
interface ProjectEntry     { title: string; tech: string; github: string; bullets: string[]; }
interface CertificationEntry { name: string; issuer: string; year: string; }

/* ── Progress steps shown while the AI is working ─────────────────── */
const AI_STATUS_STEPS = [
  { at: 0,    label: 'Starting generation…' },
  { at: 0.08, label: 'Parsing your experience…' },
  { at: 0.20, label: 'Matching skills to job description…' },
  { at: 0.35, label: 'Writing impact-driven bullets…' },
  { at: 0.52, label: 'Structuring resume sections…' },
  { at: 0.68, label: 'Polishing ATS-friendly language…' },
  { at: 0.82, label: 'Formatting PDF…' },
  { at: 0.94, label: 'Almost done…' },
];

function calcProgress(elapsed: number, estimated: number) {
  return Math.min(0.95, 1 - Math.exp(-(elapsed / estimated) * 2.8));
}

/* ── Shared section wrapper ────────────────────────────────────────── */
function Section({ label, onAdd, children }: { label: string; onAdd: () => void; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <label className="field-label mb-0">{label}</label>
        <button onClick={onAdd} className="btn btn-ghost !py-1 text-xs">+ Add</button>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/* ── Entry card wrapper ────────────────────────────────────────────── */
function EntryCard({ onRemove, children }: { onRemove?: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-3 rounded-[var(--radius-md)] border p-4" style={{ borderColor: 'var(--line)' }}>
      {children}
      {onRemove && (
        <button onClick={onRemove} className="text-xs" style={{ color: 'var(--rust)' }}>
          Remove
        </button>
      )}
    </div>
  );
}

function ResumeContent() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('handwritten');

  // — handwritten form state —
  const [title, setTitle]       = useState('');
  const [name, setName]         = useState('');
  const [phone, setPhone]       = useState('');
  const [summary, setSummary]   = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [skills, setSkills]     = useState('');
  const [experience, setExperience] = useState<ExperienceEntry[]>([
    { company: '', role: '', start: '', end: '', bullets: [''] },
  ]);
  const [education, setEducation] = useState<EducationEntry[]>([
    { institution: '', degree: '', year: '' },
  ]);
  const [projects, setProjects] = useState<ProjectEntry[]>([
    { title: '', tech: '', github: '', bullets: [''] },
  ]);
  const [achievements, setAchievements] = useState<string[]>(['']);
  const [certifications, setCertifications] = useState<CertificationEntry[]>([
    { name: '', issuer: '', year: '' },
  ]);
  const [saving, setSaving] = useState(false);

  // — AI generate state —
  const [resumeType, setResumeType]         = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [aiSkills, setAiSkills]             = useState('');
  const [aiExperience, setAiExperience]     = useState('');
  const [generating, setGenerating]         = useState(false);
  const [genProgress, setGenProgress]       = useState(0);
  const [genLabel, setGenLabel]             = useState('');
  const [genPhase, setGenPhase]             = useState<'idle' | 'running' | 'done' | 'error'>('idle');
  const [genError, setGenError]             = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAt   = useRef(0);
  const ESTIMATED_MS = 150_000;

  const resultRef = useRef<HTMLDivElement>(null);

  /* ── helpers ── */
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  };

  /* experience */
  const updateExp = (i: number, field: keyof ExperienceEntry, value: string) =>
    setExperience((p) => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  const updateExpBullet = (ei: number, bi: number, v: string) =>
    setExperience((p) => p.map((e, idx) => {
      if (idx !== ei) return e;
      const b = [...e.bullets]; b[bi] = v; return { ...e, bullets: b };
    }));
  const addExpBullet = (i: number) =>
    setExperience((p) => p.map((e, idx) => idx === i ? { ...e, bullets: [...e.bullets, ''] } : e));
  const removeExpBullet = (ei: number, bi: number) =>
    setExperience((p) => p.map((e, idx) => idx !== ei ? e : { ...e, bullets: e.bullets.filter((_, i) => i !== bi) }));

  /* education */
  const updateEdu = (i: number, f: keyof EducationEntry, v: string) =>
    setEducation((p) => p.map((e, idx) => idx === i ? { ...e, [f]: v } : e));

  /* projects */
  const updateProj = (i: number, f: keyof ProjectEntry, v: string) =>
    setProjects((p) => p.map((proj, idx) => idx === i ? { ...proj, [f]: v } : proj));
  const updateProjBullet = (pi: number, bi: number, v: string) =>
    setProjects((p) => p.map((proj, idx) => {
      if (idx !== pi) return proj;
      const b = [...proj.bullets]; b[bi] = v; return { ...proj, bullets: b };
    }));
  const addProjBullet = (i: number) =>
    setProjects((p) => p.map((proj, idx) => idx === i ? { ...proj, bullets: [...proj.bullets, ''] } : proj));
  const removeProjBullet = (pi: number, bi: number) =>
    setProjects((p) => p.map((proj, idx) => idx !== pi ? proj : { ...proj, bullets: proj.bullets.filter((_, i) => i !== bi) }));

  /* achievements / certs */
  const updateAch = (i: number, v: string) => setAchievements((p) => p.map((a, idx) => idx === i ? v : a));
  const updateCert = (i: number, f: keyof CertificationEntry, v: string) =>
    setCertifications((p) => p.map((c, idx) => idx === i ? { ...c, [f]: v } : c));

  /* ── save handwritten ── */
  const saveResume = async () => {
    setSaving(true);
    trackEvent('resume_handwritten_save_started', { title: title || 'Untitled' });
    try {
      const blob = await api.post('/resume/generate-structured', {
        title, name, phone, summary, githubUrl, websiteUrl, skills,
        experience, education, projects, achievements, certifications,
      }) as Blob;
      downloadBlob(blob, `${title || 'resume'}.pdf`);
      trackEvent('resume_handwritten_save_success', { title: title || 'Untitled' });
    } catch (err: any) {
      alert(err?.message || "Couldn't generate PDF.");
      trackEvent('resume_handwritten_save_error', { title: title || 'Untitled', error: err?.message });
    } finally {
      setSaving(false);
    }
  };

  /* ── AI generation with progress bar ── */
  const startProgressTick = () => {
    startedAt.current = Date.now();
    setGenProgress(0);
    setGenLabel(AI_STATUS_STEPS[0].label);
    intervalRef.current = setInterval(() => {
      const p = calcProgress(Date.now() - startedAt.current, ESTIMATED_MS);
      setGenProgress(p);
      const step = [...AI_STATUS_STEPS].reverse().find((s) => p >= s.at);
      if (step) setGenLabel(step.label);
    }, 400);
  };

  const stopProgressTick = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const generateResume = async () => {
    setGenerating(true);
    setGenPhase('running');
    setGenError('');
    startProgressTick();
    trackEvent('resume_ai_generation_started', { resume_type: resumeType });
    try {
      const { job_id } = await api.post('/resume/generate', {
        resume_type: resumeType,
        job_description: jobDescription,
        skills: aiSkills,
        experience: aiExperience,
      });
      const result = await api.pollJob(job_id, () => {});
      if (!result?.pdf_b64) throw new Error('No PDF data returned.');
      const bytes = Uint8Array.from(atob(result.pdf_b64), (c) => c.charCodeAt(0));
      const blob  = new Blob([bytes], { type: 'application/pdf' });
      downloadBlob(blob, 'resume.pdf');
      stopProgressTick();
      setGenProgress(1);
      setGenLabel('Done! Your PDF is downloading…');
      setGenPhase('done');
      trackEvent('resume_ai_generation_success', { resume_type: resumeType });
      // scroll to result indicator
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err: any) {
      stopProgressTick();
      setGenPhase('error');
      setGenError(err?.message || "Couldn't generate resume. Try again.");
      trackEvent('resume_ai_generation_error', { resume_type: resumeType, error: err?.message });
    } finally {
      setGenerating(false);
    }
  };

  const pct = Math.round(genProgress * 100);

  return (
    <AppShell user={user} onLogout={() => { trackEvent('logout'); logout(); }}>
      <p className="eyebrow eyebrow-accent">// resume</p>
      <h1 className="display mt-2 text-3xl font-medium">Resume builder</h1>

      {/* Tabs */}
      <div className="mt-6 flex gap-5 border-b" style={{ borderColor: 'var(--line)' }}>
        {(['handwritten', 'ai'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => { trackEvent('resume_tab_switched', { tab: t }); setTab(t); }}
            className="pb-2.5 text-sm font-medium transition-colors border-b-2"
            style={{
              borderColor: tab === t ? 'var(--indigo)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--ink-soft)',
            }}
          >
            {t === 'handwritten' ? 'Write by hand' : 'Generate with AI'}
          </button>
        ))}
      </div>

      {/* ── HANDWRITTEN TAB ── */}
      {tab === 'handwritten' && (
        <div className="panel mt-6 space-y-6 p-5 sm:p-6" style={{ maxWidth: '42rem' }}>
          <div>
            <label className="field-label">Resume title</label>
            <input className="field" placeholder="Frontend Developer Resume" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Full name</label>
              <input className="field" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input className="field" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">GitHub</label>
              <input className="field" placeholder="https://github.com/username" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Website / portfolio</label>
              <input className="field" placeholder="https://yoursite.com" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="field-label">Professional summary</label>
            <textarea className="field h-28 resize-none" placeholder="2–3 sentences about who you are and what you build." value={summary} onChange={(e) => setSummary(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Skills</label>
            <input className="field" placeholder="Python, React, PostgreSQL, Docker…" value={skills} onChange={(e) => setSkills(e.target.value)} />
          </div>

          {/* Experience */}
          <Section label="Experience" onAdd={() => setExperience((p) => [...p, { company: '', role: '', start: '', end: '', bullets: [''] }])}>
            {experience.map((exp, ei) => (
              <EntryCard key={ei} onRemove={experience.length > 1 ? () => setExperience((p) => p.filter((_, i) => i !== ei)) : undefined}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="field-label">Company</label><input className="field" placeholder="Acme Corp" value={exp.company} onChange={(e) => updateExp(ei, 'company', e.target.value)} /></div>
                  <div><label className="field-label">Role</label><input className="field" placeholder="Software Engineer" value={exp.role} onChange={(e) => updateExp(ei, 'role', e.target.value)} /></div>
                  <div><label className="field-label">Start</label><input className="field" placeholder="Jun 2023" value={exp.start} onChange={(e) => updateExp(ei, 'start', e.target.value)} /></div>
                  <div><label className="field-label">End</label><input className="field" placeholder="Present" value={exp.end} onChange={(e) => updateExp(ei, 'end', e.target.value)} /></div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="field-label mb-0">Bullets</label>
                    <button onClick={() => addExpBullet(ei)} className="btn btn-ghost !py-0.5 text-xs">+ Add</button>
                  </div>
                  {exp.bullets.map((b, bi) => (
                    <div key={bi} className="mb-2 flex gap-2">
                      <input className="field" placeholder="Built X that improved Y by Z%" value={b} onChange={(e) => updateExpBullet(ei, bi, e.target.value)} />
                      {exp.bullets.length > 1 && (
                        <button onClick={() => removeExpBullet(ei, bi)} className="btn btn-ghost !px-2 text-xs" style={{ color: 'var(--rust)' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </EntryCard>
            ))}
          </Section>

          {/* Education */}
          <Section label="Education" onAdd={() => setEducation((p) => [...p, { institution: '', degree: '', year: '' }])}>
            {education.map((edu, i) => (
              <EntryCard key={i} onRemove={education.length > 1 ? () => setEducation((p) => p.filter((_, idx) => idx !== i)) : undefined}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className="field-label">Institution</label><input className="field" placeholder="IIT Delhi" value={edu.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} /></div>
                  <div><label className="field-label">Degree</label><input className="field" placeholder="B.Tech CSE" value={edu.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} /></div>
                  <div><label className="field-label">Year</label><input className="field" placeholder="2025" value={edu.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} /></div>
                </div>
              </EntryCard>
            ))}
          </Section>

          {/* Projects */}
          <Section label="Projects" onAdd={() => setProjects((p) => [...p, { title: '', tech: '', github: '', bullets: [''] }])}>
            {projects.map((proj, pi) => (
              <EntryCard key={pi} onRemove={projects.length > 1 ? () => setProjects((p) => p.filter((_, i) => i !== pi)) : undefined}>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><label className="field-label">Title</label><input className="field" placeholder="RepoSense" value={proj.title} onChange={(e) => updateProj(pi, 'title', e.target.value)} /></div>
                  <div><label className="field-label">Tech stack</label><input className="field" placeholder="Next.js, FastAPI" value={proj.tech} onChange={(e) => updateProj(pi, 'tech', e.target.value)} /></div>
                  <div className="sm:col-span-2"><label className="field-label">GitHub link</label><input className="field" placeholder="https://github.com/…" value={proj.github} onChange={(e) => updateProj(pi, 'github', e.target.value)} /></div>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="field-label mb-0">Bullets</label>
                    <button onClick={() => addProjBullet(pi)} className="btn btn-ghost !py-0.5 text-xs">+ Add</button>
                  </div>
                  {proj.bullets.map((b, bi) => (
                    <div key={bi} className="mb-2 flex gap-2">
                      <input className="field" placeholder="What it does and its impact" value={b} onChange={(e) => updateProjBullet(pi, bi, e.target.value)} />
                      {proj.bullets.length > 1 && (
                        <button onClick={() => removeProjBullet(pi, bi)} className="btn btn-ghost !px-2 text-xs" style={{ color: 'var(--rust)' }}>✕</button>
                      )}
                    </div>
                  ))}
                </div>
              </EntryCard>
            ))}
          </Section>

          {/* Achievements */}
          <Section label="Achievements" onAdd={() => setAchievements((p) => [...p, ''])}>
            {achievements.map((a, i) => (
              <div key={i} className="flex gap-2">
                <input className="field" placeholder="Won 1st place at XYZ Hackathon" value={a} onChange={(e) => updateAch(i, e.target.value)} />
                {achievements.length > 1 && (
                  <button onClick={() => setAchievements((p) => p.filter((_, idx) => idx !== i))} className="btn btn-ghost !px-2 text-xs" style={{ color: 'var(--rust)' }}>✕</button>
                )}
              </div>
            ))}
          </Section>

          {/* Certifications */}
          <Section label="Certifications" onAdd={() => setCertifications((p) => [...p, { name: '', issuer: '', year: '' }])}>
            {certifications.map((c, i) => (
              <EntryCard key={i} onRemove={certifications.length > 1 ? () => setCertifications((p) => p.filter((_, idx) => idx !== i)) : undefined}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div><label className="field-label">Name</label><input className="field" placeholder="AWS Certified Developer" value={c.name} onChange={(e) => updateCert(i, 'name', e.target.value)} /></div>
                  <div><label className="field-label">Issuer</label><input className="field" placeholder="Amazon" value={c.issuer} onChange={(e) => updateCert(i, 'issuer', e.target.value)} /></div>
                  <div><label className="field-label">Year</label><input className="field" placeholder="2025" value={c.year} onChange={(e) => updateCert(i, 'year', e.target.value)} /></div>
                </div>
              </EntryCard>
            ))}
          </Section>

          <button
            onClick={saveResume}
            disabled={saving}
            className={`btn btn-primary w-full sm:w-auto${saving ? ' btn-loading' : ''}`}
            aria-busy={saving}
          >
            {saving ? '\u00A0' : 'Save as PDF'}
          </button>
        </div>
      )}

      {/* ── AI TAB ── */}
      {tab === 'ai' && (
        <div className="panel mt-6 space-y-5 p-5 sm:p-6" style={{ maxWidth: '42rem' }}>
          {/* Before/after teaser */}
          <div className="rounded-[var(--radius-sm)] p-4 space-y-3" style={{ background: 'var(--paper-dim)' }}>
            <p className="eyebrow eyebrow-accent">// what you get</p>
            <div className="flex flex-col gap-2 text-sm">
              <p style={{ color: 'var(--muted)' }}>
                <span className="chip chip-rust mr-2" style={{ fontSize: '0.65rem' }}>Before</span>
                "Built an internship project using FastAPI and React."
              </p>
              <p style={{ color: 'var(--ink)' }}>
                <span className="chip chip-green mr-2" style={{ fontSize: '0.65rem' }}>After</span>
                "Developed FastAPI backend handling <strong>10,000+ API requests/day</strong>, reducing latency by <strong>35%</strong> through async query optimization."
              </p>
            </div>
          </div>

          <div>
            <label className="field-label">Resume type</label>
            <select className="field" value={resumeType} onChange={(e) => setResumeType(e.target.value)}>
              <option value="">Select type…</option>
              <option value="fresher">Fresher</option>
              <option value="experienced">Experienced</option>
              <option value="senior">Senior</option>
            </select>
          </div>

          <div>
            <label className="field-label">Job description</label>
            <textarea className="field h-32 resize-none" placeholder="Paste the job description here…" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Your skills</label>
            <input className="field" placeholder="Python, React, PostgreSQL, Docker…" value={aiSkills} onChange={(e) => setAiSkills(e.target.value)} />
          </div>

          <div>
            <label className="field-label">Your experience</label>
            <textarea className="field h-28 resize-none" placeholder="Briefly describe your work experience and projects…" value={aiExperience} onChange={(e) => setAiExperience(e.target.value)} />
          </div>

          {/* Generate button */}
          <div className="flex flex-col gap-3">
            <button
              onClick={generateResume}
              disabled={generating}
              className={`btn btn-primary w-full sm:w-auto${generating ? ' btn-loading' : ''}`}
              aria-busy={generating}
            >
              {generating ? '\u00A0' : genPhase === 'done' ? '✓ PDF downloaded' : 'Generate resume PDF'}
            </button>

            {/* Progress bar */}
            {genPhase === 'running' && (
              <div className="gen-status" role="status" aria-live="polite">
                <span className="gen-label">Generating · {pct}%</span>
                <div className="progress-bar-wrap" aria-hidden="true">
                  <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
                </div>
                <span style={{ fontSize: '0.8125rem' }}>{genLabel}</span>
                <span style={{ fontSize: '0.75rem', opacity: 0.65 }}>
                  This usually takes 2–3 minutes — hang tight.
                </span>
              </div>
            )}

            {genPhase === 'done' && (
              <div ref={resultRef} id="resume-result">
                <p
                  className="chip chip-green"
                  style={{ fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}
                  role="status"
                >
                  ✓ Resume PDF downloaded successfully
                </p>
              </div>
            )}

            {genPhase === 'error' && (
              <p
                className="chip chip-rust"
                style={{ fontSize: '0.8125rem', borderRadius: 'var(--radius-sm)', padding: '0.4rem 0.75rem' }}
                role="alert"
              >
                {genError}
              </p>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ResumePage() {
  return (
    <AuthGuard>
      <ResumeContent />
    </AuthGuard>
  );
}
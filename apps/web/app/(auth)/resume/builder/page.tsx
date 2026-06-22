'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../../components/AppShell';
import AuthGuard from '../../../components/AuthGuard';

type Tab = 'handwritten' | 'ai';

interface ExperienceEntry {
  company: string;
  role: string;
  start: string;
  end: string;
  bullets: string[];
}

interface EducationEntry {
  institution: string;
  degree: string;
  year: string;
}

interface ProjectEntry {
  title: string;
  tech: string;
  github: string;
  bullets: string[];
}

function ResumeContent() {
  const { user, logout } = useAuth();
  const [tab, setTab] = useState<Tab>('handwritten');

  const [title, setTitle] = useState('');
  const [name, setName] = useState('');     // NEW — feeds structured_data.name in resume.py
  const [phone, setPhone] = useState('');    // NEW — feeds structured_data.phone in resume.py
  const [summary, setSummary] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState<ExperienceEntry[]>([
    { company: '', role: '', start: '', end: '', bullets: [''] },
  ]);
  const [education, setEducation] = useState<EducationEntry[]>([
    { institution: '', degree: '', year: '' },
  ]);
  const [projects, setProjects] = useState<ProjectEntry[]>([
    { title: '', tech: '', github: '', bullets: [''] },
  ]);
  const [saving, setSaving] = useState(false);

  const [resumeType, setResumeType] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [aiSkills, setAiSkills] = useState('');
  const [aiExperience, setAiExperience] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingStatus, setGeneratingStatus] = useState('');

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  const updateExp = (i: number, field: keyof ExperienceEntry, value: string) =>
    setExperience((p) => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  const updateExpBullet = (ei: number, bi: number, value: string) =>
    setExperience((p) => p.map((e, idx) => {
      if (idx !== ei) return e;
      const bullets = [...e.bullets]; bullets[bi] = value; return { ...e, bullets };
    }));
  const addExp = () => setExperience((p) => [...p, { company: '', role: '', start: '', end: '', bullets: [''] }]);
  const removeExp = (i: number) => setExperience((p) => p.filter((_, idx) => idx !== i));
  const addExpBullet = (i: number) => setExperience((p) => p.map((e, idx) => idx === i ? { ...e, bullets: [...e.bullets, ''] } : e));
  const removeExpBullet = (ei: number, bi: number) => setExperience((p) => p.map((e, idx) => idx !== ei ? e : { ...e, bullets: e.bullets.filter((_, i) => i !== bi) }));

  const updateEdu = (i: number, field: keyof EducationEntry, value: string) =>
    setEducation((p) => p.map((e, idx) => idx === i ? { ...e, [field]: value } : e));
  const addEdu = () => setEducation((p) => [...p, { institution: '', degree: '', year: '' }]);
  const removeEdu = (i: number) => setEducation((p) => p.filter((_, idx) => idx !== i));

  const updateProj = (i: number, field: keyof ProjectEntry, value: string) =>
    setProjects((p) => p.map((proj, idx) => idx === i ? { ...proj, [field]: value } : proj));
  const updateProjBullet = (pi: number, bi: number, value: string) =>
    setProjects((p) => p.map((proj, idx) => {
      if (idx !== pi) return proj;
      const bullets = [...proj.bullets]; bullets[bi] = value; return { ...proj, bullets };
    }));
  const addProj = () => setProjects((p) => [...p, { title: '', tech: '', github: '', bullets: [''] }]);
  const removeProj = (i: number) => setProjects((p) => p.filter((_, idx) => idx !== i));
  const addProjBullet = (i: number) => setProjects((p) => p.map((proj, idx) => idx === i ? { ...proj, bullets: [...proj.bullets, ''] } : proj));
  const removeProjBullet = (pi: number, bi: number) => setProjects((p) => p.map((proj, idx) => idx !== pi ? proj : { ...proj, bullets: proj.bullets.filter((_, i) => i !== bi) }));

  const saveResume = async () => {
    setSaving(true);
    try {
      const blob = await api.post('/resume/generate-structured', {
        title, name, phone, summary, githubUrl, websiteUrl, skills, experience, education, projects,
      }) as Blob;
      downloadBlob(blob, `${title || 'resume'}.pdf`);
    } catch (err: any) {
      alert(err?.message || "Couldn't generate PDF.");
    } finally {
      setSaving(false);
    }
  };

  const generateResume = async () => {
    setGenerating(true);
    setGeneratingStatus('Starting…');
    try {
      const { job_id } = await api.post('/resume/generate', {
        resume_type: resumeType,
        job_description: jobDescription,
        skills: aiSkills,
        experience: aiExperience,
      });
      const result = await api.pollJob(job_id, (status) => {
        setGeneratingStatus(status === 'running' ? 'Generating resume…' : status);
      });
      if (!result?.pdf_b64) throw new Error('No PDF data returned.');
      const byteChars = atob(result.pdf_b64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) bytes[i] = byteChars.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      downloadBlob(blob, 'resume.pdf');
    } catch (err: any) {
      alert(err?.message || "Couldn't generate resume.");
    } finally {
      setGenerating(false);
      setGeneratingStatus('');
    }
  };

  return (
    <AppShell user={user} onLogout={logout}>
      <p className="eyebrow eyebrow-accent">// resume</p>
      <h1 className="display mt-2 text-3xl font-medium">Resume builder</h1>

      <div className="mt-6 flex gap-4 border-b" style={{ borderColor: 'var(--line)' }}>
        {(['handwritten', 'ai'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-2 text-sm font-medium border-b-2 transition-colors"
            style={{
              borderColor: tab === t ? 'var(--indigo)' : 'transparent',
              color: tab === t ? 'var(--ink)' : 'var(--ink-soft)',
            }}
          >
            {t === 'handwritten' ? 'Write by hand' : 'Generate with AI'}
          </button>
        ))}
      </div>

      {tab === 'handwritten' && (
        <div className="panel mt-6 max-w-2xl space-y-6 p-6">
          <div>
            <label className="field-label">Resume title</label>
            <input className="field" placeholder="Frontend Developer Resume" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {/* NEW — Name / Phone, needed for the resume header */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">Full name</label>
              <input className="field" placeholder="Jane Doe" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <label className="field-label">Phone</label>
              <input className="field" placeholder="+1 555 555 5555" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="field-label">GitHub profile</label>
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

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="field-label mb-0">Experience</label>
              <button onClick={addExp} className="btn btn-ghost !py-1 text-xs">+ Add</button>
            </div>
            <div className="space-y-4">
              {experience.map((exp, ei) => (
                <div key={ei} className="rounded-[var(--radius)] border p-4 space-y-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Company</label>
                      <input className="field" placeholder="Acme Corp" value={exp.company} onChange={(e) => updateExp(ei, 'company', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Role</label>
                      <input className="field" placeholder="Software Engineer" value={exp.role} onChange={(e) => updateExp(ei, 'role', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Start</label>
                      <input className="field" placeholder="Jun 2023" value={exp.start} onChange={(e) => updateExp(ei, 'start', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">End</label>
                      <input className="field" placeholder="Present" value={exp.end} onChange={(e) => updateExp(ei, 'end', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="field-label mb-0">Bullets</label>
                      <button onClick={() => addExpBullet(ei)} className="btn btn-ghost !py-0.5 text-xs">+ Add bullet</button>
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
                  {experience.length > 1 && (
                    <button onClick={() => removeExp(ei)} className="text-xs" style={{ color: 'var(--rust)' }}>Remove experience</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="field-label mb-0">Education</label>
              <button onClick={addEdu} className="btn btn-ghost !py-1 text-xs">+ Add</button>
            </div>
            <div className="space-y-3">
              {education.map((edu, i) => (
                <div key={i} className="rounded-[var(--radius)] border p-4" style={{ borderColor: 'var(--line)' }}>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <label className="field-label">Institution</label>
                      <input className="field" placeholder="MIT" value={edu.institution} onChange={(e) => updateEdu(i, 'institution', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Degree</label>
                      <input className="field" placeholder="B.Tech Computer Science" value={edu.degree} onChange={(e) => updateEdu(i, 'degree', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Year</label>
                      <input className="field" placeholder="2024" value={edu.year} onChange={(e) => updateEdu(i, 'year', e.target.value)} />
                    </div>
                  </div>
                  {education.length > 1 && (
                    <button onClick={() => removeEdu(i)} className="mt-3 text-xs" style={{ color: 'var(--rust)' }}>Remove</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <label className="field-label mb-0">Projects</label>
              <button onClick={addProj} className="btn btn-ghost !py-1 text-xs">+ Add</button>
            </div>
            <div className="space-y-4">
              {projects.map((proj, pi) => (
                <div key={pi} className="rounded-[var(--radius)] border p-4 space-y-3" style={{ borderColor: 'var(--line)' }}>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Title</label>
                      <input className="field" placeholder="RepoSense" value={proj.title} onChange={(e) => updateProj(pi, 'title', e.target.value)} />
                    </div>
                    <div>
                      <label className="field-label">Tech stack</label>
                      <input className="field" placeholder="Next.js, FastAPI, PostgreSQL" value={proj.tech} onChange={(e) => updateProj(pi, 'tech', e.target.value)} />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="field-label">GitHub link</label>
                      <input className="field" placeholder="https://github.com/username/repo" value={proj.github} onChange={(e) => updateProj(pi, 'github', e.target.value)} />
                    </div>
                  </div>
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <label className="field-label mb-0">Bullets</label>
                      <button onClick={() => addProjBullet(pi)} className="btn btn-ghost !py-0.5 text-xs">+ Add bullet</button>
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
                  {projects.length > 1 && (
                    <button onClick={() => removeProj(pi)} className="text-xs" style={{ color: 'var(--rust)' }}>Remove project</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button onClick={saveResume} disabled={saving} className="btn btn-primary">
            {saving ? 'Generating PDF…' : 'Save as PDF'}
          </button>
        </div>
      )}

      {tab === 'ai' && (
        <div className="panel mt-6 max-w-2xl space-y-5 p-6">
          <div>
            <label className="field-label">Resume type</label>
            <select className="field" value={resumeType} onChange={(e) => setResumeType(e.target.value)}>
              <option value="">Select type</option>
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

          <button onClick={generateResume} disabled={generating} className="btn btn-primary">
            {generating
              ? generatingStatus || 'Generating PDF…'
              : 'Generate resume PDF'}
          </button>
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
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AppShell from '../../components/AppShell';

export default function ResumeGenerate() {
  const { user, logout } = useAuth();

  const [resumeType, setResumeType] = useState('internship');
  const [jobDescription, setJobDescription] = useState('');
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const generateResume = async () => {
    if (!jobDescription.trim()) {
      alert('Paste a job description first.');
      return;
    }

    setLoading(true);
    try {
      const pdfBlob = await api.post('/resume/generate', {
        resume_type: resumeType,
        job_description: jobDescription,
        skills,
        experience,
      });

      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || 'resume'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      alert("Resume generation failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user} onLogout={logout}>
      <p className="eyebrow eyebrow-accent">// resume</p>
      <h1 className="display mt-2 text-3xl font-medium">Resume builder</h1>

      <div className="mt-6 flex gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <Link href="/resume/builder" className="nav-link pb-2 text-sm">
          Write by hand
        </Link>
        <span className="border-b-2 pb-2 text-sm font-semibold" style={{ borderColor: 'var(--indigo)', color: 'var(--ink)' }}>
          Generate from a job
        </span>
      </div>

      <div className="panel mt-6 max-w-2xl p-6">
        <div className="space-y-5">
          <div>
            <label className="field-label">Resume title</label>
            <input
              type="text"
              placeholder="Resume Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="field"
            />
          </div>

          <div>
            <label className="field-label">Resume type</label>
            <select
              value={resumeType}
              onChange={(e) => setResumeType(e.target.value)}
              className="field"
            >
              <option value="internship">Internship resume</option>
              <option value="full-time">Full-time resume</option>
            </select>
          </div>

          <div>
            <label className="field-label">Job description</label>
            <textarea
              placeholder="Paste the complete job description…"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              className="field h-48 resize-none"
            />
          </div>

          <div>
            <label className="field-label">Skills</label>
            <textarea
              placeholder="Python, FastAPI, React, SQL…"
              value={skills}
              onChange={(e) => setSkills(e.target.value)}
              className="field h-24 resize-none"
            />
          </div>

          <div>
            <label className="field-label">Experience / projects</label>
            <textarea
              placeholder="Internships, projects, coursework…"
              value={experience}
              onChange={(e) => setExperience(e.target.value)}
              className="field h-32 resize-none"
            />
          </div>

          <button onClick={generateResume} disabled={loading} className="btn btn-primary">
            {loading ? 'Generating…' : 'Generate resume PDF'}
          </button>
        </div>
      </div>
    </AppShell>
  );
}
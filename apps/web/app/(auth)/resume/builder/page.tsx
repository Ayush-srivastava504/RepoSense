'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AppShell from '../../components/AppShell';

export default function ResumeBuilder() {
  const { user, logout } = useAuth();

  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);

  const saveResume = async () => {
    try {
      setLoading(true);

      const payload = {
        title,
        content: {
          summary,
          experience: [],
        },
      };

      await api.post('/resume/create', payload);
      alert('Resume saved.');
    } catch (err: any) {
      console.error(err);
      alert(err?.message || "Couldn't save the resume.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user} onLogout={logout}>
      <p className="eyebrow eyebrow-accent">// resume</p>
      <h1 className="display mt-2 text-3xl font-medium">Resume builder</h1>

      <div className="mt-6 flex gap-2 border-b" style={{ borderColor: 'var(--line)' }}>
        <span className="border-b-2 pb-2 text-sm font-semibold" style={{ borderColor: 'var(--indigo)', color: 'var(--ink)' }}>
          Write by hand
        </span>
        <Link href="/resume/generate" className="nav-link pb-2 text-sm">
          Generate from a job
        </Link>
      </div>

      <div className="panel mt-6 max-w-2xl p-6">
        <div className="mb-5">
          <label className="field-label">Resume title</label>
          <input
            className="field"
            placeholder="Frontend Developer Resume"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="mb-6">
          <label className="field-label">Professional summary</label>
          <textarea
            className="field h-48 resize-none"
            placeholder="Write a 2–3 sentence summary of who you are and what you build."
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
          />
        </div>

        <button onClick={saveResume} disabled={loading} className="btn btn-primary">
          {loading ? 'Saving…' : 'Save resume'}
        </button>
      </div>
    </AppShell>
  );
}
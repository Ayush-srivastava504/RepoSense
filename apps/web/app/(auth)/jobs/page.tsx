'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import AppShell from '../../components/AppShell';

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  posted_at: string;
}

export default function JobsPage() {
  const { user, token, logout } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) return;
    fetchJobs();
  }, [token]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const data = await api.get('/jobs?limit=50');
      setJobs(data);
      setError('');
    } catch (err: any) {
      setError(err.message || "Couldn't load internships.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell user={user} onLogout={logout}>
      <p className="eyebrow eyebrow-accent">// internships</p>
      <h1 className="display mt-2 text-3xl font-medium">Latest postings</h1>
      <p className="mt-2" style={{ color: 'var(--ink-soft)' }}>
        Pulled from multiple sources and refreshed daily.
      </p>

      {loading && <p className="mt-10 eyebrow">loading internships…</p>}

      {!loading && error && (
        <div className="panel mt-8 p-6">
          <p className="chip chip-rust !inline-block">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {jobs.map((job) => (
            <div key={job.id} className="panel flex flex-col p-5">
              <p className="eyebrow">
                {job.source} · {new Date(job.posted_at).toLocaleDateString()}
              </p>
              <h2 className="display mt-2 text-lg font-medium">{job.title}</h2>
              <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
                {job.company}
              </p>
              <p className="mt-3 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {job.description.substring(0, 150)}…
              </p>
              <a
                href={job.url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary mt-4 self-start text-sm"
              >
                Apply
              </a>
            </div>
          ))}

          {!jobs.length && (
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              No internships found right now — check back soon.
            </p>
          )}
        </div>
      )}
    </AppShell>
  );
}
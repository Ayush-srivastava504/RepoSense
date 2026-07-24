'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import AuthGuard from '../../components/AuthGuard';
import { trackEvent } from '@/lib/analytics';

function CoverLetterContent() {
  useAuth();
  const [companyName, setCompanyName] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [letter, setLetter] = useState('');
  const [copied, setCopied] = useState(false);

  async function generate() {
    if (jobDescription.trim().length < 30) {
      setError('Paste the job description first — a line or two isn\u2019t enough to tailor a letter.');
      return;
    }
    if (resumeText.trim().length < 30) {
      setError('Paste your resume text too, so the letter can reference real experience.');
      return;
    }
    setError('');
    setLoading(true);
    setLetter('');
    setCopied(false);
    try {
      const { job_id } = await api.post('/resume/cover-letter', {
        job_description: jobDescription,
        resume_text: resumeText,
        company_name: companyName,
      });
      // The LLM call regularly takes 100+ seconds, so this goes through the
      // same background-job + poll pattern as resume generation rather than
      // waiting on the request itself (which a reverse proxy would kill).
      const result = await api.pollJob(job_id, () => {});
      setLetter(result?.letter || '');
      trackEvent('cover_letter_generated', { has_company: Boolean(companyName) });
    } catch (e: any) {
      setError(e?.message || 'Could not generate a letter. Try again in a moment.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLetter() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard permissions denied — silently ignore, letter is still selectable
    }
  }

  return (
    <div className="container-xl py-12">
      <div className="max-w-2xl">
        <p className="eyebrow eyebrow-accent mb-3">// cover letter generator</p>
        <h1 className="text-3xl font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
          A tailored cover letter, not a template
        </h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Paste the job description and your resume text. The letter references specific things from
          both, so it doesn't read like a form letter with the company name swapped in.
        </p>
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_1fr]">
        <div className="space-y-4">
          <div>
            <label className="field-label">Company name (optional)</label>
            <input
              className="field"
              placeholder="e.g. Razorpay"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label">Job description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the internship or job posting here…"
              rows={8}
              className="field font-mono text-xs leading-relaxed"
            />
          </div>

          <div>
            <label className="field-label">Your resume text</label>
            <textarea
              value={resumeText}
              onChange={(e) => setResumeText(e.target.value)}
              placeholder="Paste your resume text here…"
              rows={8}
              className="field font-mono text-xs leading-relaxed"
            />
          </div>

          {error && (
            <p style={{ color: 'var(--rust)', fontSize: '0.8125rem' }} role="alert">{error}</p>
          )}

          <button onClick={generate} disabled={loading} className="btn btn-primary">
            {loading ? 'Writing…' : 'Generate cover letter'}
          </button>
        </div>

        <div>
          {!letter && !loading && (
            <div
              className="rounded-[var(--radius-md)] border p-6 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
            >
              Your generated letter will show up here — editable, ready to copy into an application.
            </div>
          )}

          {loading && (
            <div
              className="rounded-[var(--radius-md)] border p-6 text-sm"
              style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
            >
              Writing a draft based on your resume and the job description… this can take a minute or two.
            </div>
          )}

          {letter && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="field-label mb-0">Draft</p>
                <button onClick={copyLetter} className="btn btn-ghost !py-1 text-xs">
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <textarea
                value={letter}
                onChange={(e) => setLetter(e.target.value)}
                rows={20}
                className="field text-sm leading-relaxed"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CoverLetterPage() {
  return (
    <AuthGuard>
      <CoverLetterContent />
    </AuthGuard>
  );
}

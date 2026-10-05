// Module: app/tracker/TrackerBoard.tsx
// The pipeline board: a stage bar, closing-soon banner, four stage lanes (tabs on mobile) and a collapsed
// Rejected list. Data lives in localStorage via lib/tracker.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getTrackedJobs,
  updateStatus,
  removeTrackedJob,
  subscribeTracker,
  daysUntilDeadline,
  STATUS_LABELS,
  STATUS_ORDER,
  type ApplicationStatus,
  type TrackedJob,
} from '@/lib/tracker';
import { trackEvent } from '@/lib/analytics';

const STAGE_COLOR: Record<ApplicationStatus, string> = {
  saved: 'var(--line-strong)',
  applied: 'var(--ink-soft)',
  interviewing: 'var(--indigo)',
  offer: 'var(--green)',
  rejected: 'var(--rust)',
};
// The one-tap move shown on each card. Offer and Rejected are end states, so they have none.
const NEXT: Partial<Record<ApplicationStatus, { to: ApplicationStatus; label: string }>> = {
  saved: { to: 'applied', label: 'Mark applied' },
  applied: { to: 'interviewing', label: 'Got an interview' },
  interviewing: { to: 'offer', label: 'Got an offer' },
};
const LANES = STATUS_ORDER.filter((s) => s !== 'rejected');
const DAY = 24 * 60 * 60 * 1000;

function daysSince(iso: string): number {
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? 0 : Math.floor((Date.now() - t) / DAY);
}

function deadlineInfo(deadline?: string): { text: string; color: string } | null {
  const days = daysUntilDeadline(deadline);
  if (days === null) return null;
  if (days < 0) return { text: 'Deadline passed', color: 'var(--muted)' };
  const text = days === 0 ? 'Closes today' : `Closes in ${days} day${days === 1 ? '' : 's'}`;
  if (days <= 2) return { text, color: 'var(--rust)' };
  if (days <= 7) return { text, color: 'var(--score-amber, #b45309)' };
  return { text, color: 'var(--ink-soft)' };
}

function TrackedJobCard({ job }: { job: TrackedJob }) {
  const due = job.status === 'saved' || job.status === 'applied' ? deadlineInfo(job.deadline) : null;
  const waiting = job.status === 'applied' ? daysSince(job.statusUpdatedAt) : 0;
  const next = NEXT[job.status];
  return (
    <article className="flex flex-col gap-3 rounded-[var(--radius-md)] p-3" style={{ background: 'var(--paper)', border: '1px solid var(--line)' }}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-md text-sm font-semibold" style={{ background: 'var(--paper-dim)', color: 'var(--ink-soft)' }}>
          {job.company.trim().charAt(0).toUpperCase() || '?'}
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold leading-snug">
            {job.url ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{job.title}</a>
            ) : job.title}
          </p>
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--ink-soft)' }}>
            {job.company}{job.location ? `, ${job.location}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            removeTrackedJob(job.jobId);
            trackEvent('tracker_remove', { job_id: job.jobId });
          }}
          aria-label={`Remove ${job.title}`}
          className="-mr-1 -mt-1 flex h-8 w-8 flex-none items-center justify-center rounded-md text-sm transition-colors hover:bg-[var(--paper-dim)]"
          style={{ color: 'var(--muted)' }}
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      {(due || waiting >= 7) && (
        <p className="text-xs font-medium" style={{ color: due ? due.color : 'var(--score-amber, #b45309)' }}>
          {due ? due.text : `No reply in ${waiting} days. Worth a follow-up.`}
        </p>
      )}

      <div className="flex items-center gap-2">
        {next && (
          <button
            type="button"
            onClick={() => {
              updateStatus(job.jobId, next.to);
              trackEvent('tracker_status_change', { job_id: job.jobId, status: next.to });
            }}
            className="btn btn-secondary min-h-[36px] flex-1 !px-2 !py-1 text-xs"
          >
            {next.label}
          </button>
        )}
        <select
          aria-label={`Status of ${job.title}`}
          value={job.status}
          onChange={(e) => {
            const status = e.target.value as ApplicationStatus;
            updateStatus(job.jobId, status);
            trackEvent('tracker_status_change', { job_id: job.jobId, status });
          }}
          className={`min-h-[36px] rounded-md px-1.5 text-xs ${next ? 'w-[6.5rem]' : 'flex-1'}`}
          style={{ border: '1px solid var(--line-strong)', background: 'transparent', color: 'var(--ink)' }}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>
    </article>
  );
}

export default function TrackerBoard() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [activeTab, setActiveTab] = useState<ApplicationStatus>(STATUS_ORDER[0]);

  useEffect(() => {
    setJobs(getTrackedJobs());
    trackEvent('tracker_view');
    return subscribeTracker(() => setJobs(getTrackedJobs()));
  }, []);

  const byStatus = (status: ApplicationStatus) => jobs.filter((j) => j.status === status);
  const closing = jobs
    .map((job) => ({ job, days: daysUntilDeadline(job.deadline) }))
    .filter((x): x is { job: TrackedJob; days: number } => x.days !== null && x.days >= 0 && x.days <= 7 && (x.job.status === 'saved' || x.job.status === 'applied'))
    .sort((a, b) => a.days - b.days);
  const rejected = byStatus('rejected');
  const inPlay = jobs.length - rejected.length;

  return (
    <section aria-label="Application pipeline" className="mt-8">
      {jobs.length === 0 ? (
        <div className="panel p-6 sm:p-8">
          <h2 className="display text-xl font-medium">Your pipeline starts with one saved listing</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Tap the bookmark on any job or internship. It shows up in Saved, and you move it across as you apply, interview and get offers.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/internships" className="btn btn-primary text-sm">Browse internships</Link>
            <Link href="/jobs" className="btn btn-secondary text-sm">Browse jobs</Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="display text-xl font-medium">{inPlay} in play</h2>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>Saved on this device only</p>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full" style={{ background: 'var(--line)' }} role="img" aria-label={LANES.map((s) => `${byStatus(s).length} ${STATUS_LABELS[s].toLowerCase()}`).join(', ')}>
              {LANES.map((s) => byStatus(s).length > 0 && (
                <span key={s} style={{ width: `${(byStatus(s).length / Math.max(inPlay, 1)) * 100}%`, background: STAGE_COLOR[s] }} />
              ))}
            </div>
          </div>

          {closing.length > 0 && (
            <div className="rounded-[var(--radius-md)] p-4" style={{ background: 'var(--rust-soft)', border: '1px solid var(--rust)' }}>
              <p className="text-sm font-semibold">Closing this week</p>
              <ul className="mt-2 space-y-1">
                {closing.map(({ job, days }) => (
                  <li key={job.jobId} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">{job.title} <span style={{ color: 'var(--ink-soft)' }}>at {job.company}</span></span>
                    <span className="flex-none text-xs font-semibold" style={{ color: days <= 2 ? 'var(--rust)' : 'var(--ink)' }}>
                      {days === 0 ? 'Today' : `${days}d left`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Mobile and tablet: one stage at a time */}
      <div className="mt-6 lg:hidden">
        <div role="tablist" aria-label="Stages" className="no-scrollbar flex gap-1.5 overflow-x-auto pb-1">
          {STATUS_ORDER.map((status) => (
            <button
              key={status}
              role="tab"
              aria-selected={activeTab === status}
              type="button"
              onClick={() => setActiveTab(status)}
              className={`flex-none whitespace-nowrap rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                activeTab === status ? 'bg-[var(--ink)] text-[var(--paper)]' : 'bg-[var(--paper-dim)] text-[var(--ink-soft)]'
              }`}
            >
              {STATUS_LABELS[status]} <span className="ml-1 tabular-nums opacity-70">{byStatus(status).length}</span>
            </button>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-3">
          {byStatus(activeTab).length === 0 ? (
            <p className="py-8 text-center text-sm" style={{ color: 'var(--muted)' }}>Nothing in {STATUS_LABELS[activeTab].toLowerCase()} yet.</p>
          ) : (
            byStatus(activeTab).map((job) => <TrackedJobCard key={job.jobId} job={job} />)
          )}
        </div>
      </div>

      {/* Desktop: four stage lanes, Rejected tucked below */}
      <div className="mt-6 hidden items-start gap-3 lg:grid lg:grid-cols-4">
        {LANES.map((status) => (
          <div key={status} className="flex min-h-[8rem] flex-col gap-2.5 rounded-[var(--radius-lg)] p-2.5" style={{ background: 'var(--paper-dim)' }}>
            <div className="flex items-center gap-2 px-1.5 pt-1">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full" style={{ background: STAGE_COLOR[status] }} />
              <h3 className="text-sm font-semibold">{STATUS_LABELS[status]}</h3>
              <span className="ml-auto text-xs tabular-nums" style={{ color: 'var(--muted)' }}>{byStatus(status).length}</span>
            </div>
            {byStatus(status).length === 0 ? (
              <p className="px-1.5 py-4 text-xs" style={{ color: 'var(--muted)' }}>Nothing here yet.</p>
            ) : (
              byStatus(status).map((job) => <TrackedJobCard key={job.jobId} job={job} />)
            )}
          </div>
        ))}
      </div>

      {rejected.length > 0 && (
        <details className="mt-4 hidden rounded-[var(--radius-md)] p-3 lg:block" style={{ border: '1px solid var(--line)' }}>
          <summary className="cursor-pointer text-sm font-semibold">Rejected ({rejected.length})</summary>
          <div className="mt-3 grid grid-cols-4 gap-3">
            {rejected.map((job) => <TrackedJobCard key={job.jobId} job={job} />)}
          </div>
        </details>
      )}
    </section>
  );
}

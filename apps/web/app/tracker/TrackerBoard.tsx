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

function DeadlinePill({ deadline }: { deadline?: string }) {
  const days = daysUntilDeadline(deadline);
  if (days === null) return null;

  let color = 'var(--muted)';
  let text = `${days} day${days === 1 ? '' : 's'} left`;
  if (days < 0) {
    color = 'var(--muted)';
    text = 'Deadline passed';
  } else if (days <= 2) {
    color = 'var(--rust)';
  } else if (days <= 7) {
    color = 'var(--score-amber, #b45309)';
  }

  return (
    <span className="text-[11px] font-medium" style={{ color }}>
      ⏳ {text}
    </span>
  );
}

function TrackedJobCard({ job }: { job: TrackedJob }) {
  return (
    <div className="panel flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" style={{ color: 'var(--ink)' }}>
            {job.title}
          </p>
          <p className="truncate text-xs" style={{ color: 'var(--ink-soft)' }}>
            {job.company}
            {job.location ? ` · ${job.location}` : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            removeTrackedJob(job.jobId);
            trackEvent('tracker_remove', { job_id: job.jobId });
          }}
          aria-label="Remove"
          className="shrink-0 text-xs"
          style={{ color: 'var(--muted)' }}
        >
          ✕
        </button>
      </div>

      <DeadlinePill deadline={job.deadline} />

      <div className="flex items-center gap-2">
        <select
          value={job.status}
          onChange={(e) => {
            const status = e.target.value as ApplicationStatus;
            updateStatus(job.jobId, status);
            trackEvent('tracker_status_change', { job_id: job.jobId, status });
          }}
          className="flex-1 rounded-md p-1.5 text-xs"
          style={{
            border: '1px solid var(--line-strong)',
            background: 'transparent',
            color: 'var(--ink)',
          }}
        >
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary px-2 py-1 text-[11px]"
          >
            View →
          </a>
        )}
      </div>
    </div>
  );
}

export default function TrackerBoard() {
  const [jobs, setJobs] = useState<TrackedJob[]>([]);

  useEffect(() => {
    setJobs(getTrackedJobs());
    trackEvent('tracker_view');
    return subscribeTracker(() => setJobs(getTrackedJobs()));
  }, []);

  const byStatus = (status: ApplicationStatus) =>
    jobs.filter((j) => j.status === status);

  const upcomingDeadlines = jobs
    .filter((j) => {
      const d = daysUntilDeadline(j.deadline);
      return d !== null && d >= 0 && d <= 7 && j.status !== 'rejected';
    })
    .sort(
      (a, b) => (daysUntilDeadline(a.deadline) ?? 0) - (daysUntilDeadline(b.deadline) ?? 0)
    );

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-3">
        <h2 className="display text-xl font-medium" style={{ color: 'var(--ink)' }}>
          Your pipeline
        </h2>
      </div>

      {upcomingDeadlines.length > 0 && (
        <div className="panel mt-6 flex flex-col gap-1.5 p-4" style={{ borderColor: 'var(--rust)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>
            ⏳ {upcomingDeadlines.length} deadline
            {upcomingDeadlines.length === 1 ? '' : 's'} coming up this week
          </p>
          <div className="flex flex-wrap gap-2">
            {upcomingDeadlines.map((j) => (
              <span key={j.jobId} className="chip chip-rust text-[11px]">
                {j.title} · {j.company}
              </span>
            ))}
          </div>
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="panel mt-8 flex flex-col items-center gap-3 p-10 text-center">
          <p className="text-sm" style={{ color: 'var(--ink-soft)' }}>
            You haven&apos;t saved any jobs yet. Tap the bookmark icon on any
            listing to start building your pipeline.
          </p>
          <Link href="/jobs" className="btn btn-primary px-4 py-2 text-sm">
            Browse jobs →
          </Link>
        </div>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {STATUS_ORDER.map((status) => (
            <div key={status} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                  {STATUS_LABELS[status]}
                </p>
                <span className="chip chip-muted text-[11px]">{byStatus(status).length}</span>
              </div>
              <div className="flex flex-col gap-3">
                {byStatus(status).map((job) => (
                  <TrackedJobCard key={job.jobId} job={job} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

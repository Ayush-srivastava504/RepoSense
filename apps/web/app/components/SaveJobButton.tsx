'use client';

import { useEffect, useState } from 'react';
import { isTracked, saveJob, removeTrackedJob, subscribeTracker } from '@/lib/tracker';
import { trackEvent } from '@/lib/analytics';
import type { Job } from '@/lib/jobs';

/**
 * Bookmark / unbookmark a job into the "My Applications" tracker
 * (lib/tracker.ts, /tracker board). Deliberately stopPropagation +
 * preventDefault so it can sit inside the JobCard <Link> without
 * navigating away when clicked.
 */
export default function SaveJobButton({
  job,
  size = 'md',
}: {
  job: Job;
  size?: 'sm' | 'md';
}) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSaved(isTracked(job.id));
    return subscribeTracker(() => setSaved(isTracked(job.id)));
  }, [job.id]);

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (saved) {
      removeTrackedJob(job.id);
      trackEvent('tracker_remove', { job_id: job.id });
    } else {
      saveJob({
        id: job.id,
        title: job.title,
        company: job.company,
        url: job.url,
        location: job.location,
        deadline: job.deadline,
      });
      trackEvent('tracker_save', { job_id: job.id });
    }
  };

  const dim = size === 'sm' ? 30 : 36;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={saved ? 'Remove from My Applications' : 'Save to My Applications'}
      aria-pressed={saved}
      title={saved ? 'Saved to My Applications' : 'Save to My Applications'}
      className="flex shrink-0 items-center justify-center rounded-full transition-colors"
      style={{
        width: dim,
        height: dim,
        border: `1px solid ${saved ? 'var(--indigo)' : 'var(--line-strong)'}`,
        background: saved ? 'var(--indigo-soft)' : 'transparent',
        color: saved ? 'var(--indigo)' : 'var(--muted)',
      }}
    >
      <svg
        width={size === 'sm' ? 14 : 16}
        height={size === 'sm' ? 14 : 16}
        viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeWidth={2}
      >
        <path d="M19 21l-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
  );
}

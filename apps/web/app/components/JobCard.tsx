import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { jobSlug } from '@/lib/slug';
import JobBadges from './JobBadges';

export default function JobCard({ job, basePath = '/jobs' }: { job: Job; basePath?: string }) {
  return (
    <Link
      href={`${basePath}/${jobSlug(job)}`}
      className="panel flex h-full flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">
          {job.source || 'Unknown'} ·{' '}
          {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'Recent'}
        </p>

        {job.type && (
          <span className="chip chip-muted text-[11px]">{job.type}</span>
        )}
      </div>

      <JobBadges job={job} className="mt-2" />

      {job.location && (
        <span className="chip chip-muted mt-2 w-fit text-[11px]">{job.location}</span>
      )}

      <h2 className="display mt-4 text-lg font-medium leading-snug" style={{ color: 'var(--ink)' }}>
        {job.title}
      </h2>

      <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
        {job.company}
      </p>

      <p className="mt-4 flex-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
        {job.description ? `${job.description.substring(0, 180)}...` : 'No description available.'}
      </p>
    </Link>
  );
}

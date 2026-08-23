// Module: app/components/JobCard.tsx
// Defines component(s)/export(s): JobCard
//
//

import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { jobSlug } from '@/lib/slug';
import { timeAgo } from '@/lib/timeAgo';
import JobBadges from './JobBadges';
import CompanyLogo from './CompanyLogo';
import SaveJobButton from './SaveJobButton';
import MatchScoreBadge from './MatchScoreBadge';
export default function JobCard({ job, basePath = '/jobs' }: {
    job: Job;
    basePath?: string;
}) {
    const pay = job.salary || job.stipend;
    return (<Link href={`${basePath}/${jobSlug(job)}`} className="panel group flex h-full flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="display text-lg font-medium leading-snug" style={{ color: 'var(--ink)' }}>
            {job.title}
          </h2>

          <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
            {job.company}
          </p>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <CompanyLogo company={job.company} logoDomain={job.logo_domain} size={44}/>
          <SaveJobButton job={job} size="sm"/>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {job.location && (<span className="chip chip-muted text-[11px]">📍 {job.location}</span>)}

        {job.type && <span className="chip chip-muted text-[11px]">{job.type}</span>}

        <MatchScoreBadge job={job}/>
      </div>

      <JobBadges job={job} className="mt-2"/>

      {job.is_government && (job.department || job.vacancies) && (<p className="mt-2 text-[11px]" style={{ color: 'var(--ink-soft)' }}>
          {job.department && <span>{job.department}</span>}
          {job.department && job.vacancies && ' · '}
          {job.vacancies && <span>{job.vacancies} vacancies</span>}
        </p>)}

      <p className="mt-4 flex-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
        {job.description ? `${job.description.substring(0, 160)}...` : 'No description available.'}
      </p>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3" style={{ borderColor: 'var(--line)' }}>
        <div className="flex flex-col text-[11px]" style={{ color: 'var(--muted)' }}>
          {pay && (<span className="font-medium" style={{ color: 'var(--ink)' }}>
              {pay}
            </span>)}
          <span>{timeAgo(job.posted_at)}</span>
        </div>

        <span className="btn btn-secondary px-3 py-1.5 text-xs transition-colors group-hover:border-[var(--indigo)] group-hover:text-[var(--indigo)]">
          Apply now →
        </span>
      </div>
    </Link>);
}

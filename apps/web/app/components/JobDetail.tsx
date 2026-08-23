// Module: app/components/JobDetail.tsx
// Defines component(s)/export(s): JobDetail
// Defines function(s): matchSkillSlug
//
// JobPosting JSON-LD for this job is emitted once, at the page level (jobs/internships/
// remote-jobs/government-jobs [slug] pages via lib/structuredData.ts jobPostingSchema) —
// this component used to also render its own copy, which meant every job page shipped two
// separate, slightly inconsistent JobPosting blocks. Don't re-add schema here.

import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { getSimilarJobs } from '@/lib/jobs';
import { companySlug } from '@/lib/companies';
import { SKILLS } from '@/app/skills/data';
import JobBadges from '@/app/components/JobBadges';
import ApplyButton from '@/app/components/ApplyButton';
import SimilarJobs from '@/app/components/SimilarJobs';
import SaveJobButton from '@/app/components/SaveJobButton';
import MatchScoreBadge from '@/app/components/MatchScoreBadge';
// Matches an enriched keyword to a known /skills/[slug] hub page, if one exists, so we can
// link it instead of rendering a dead-end chip. Falls back to null for keywords without a
// dedicated hub (e.g. soft skills) — those still render as plain chips.
function matchSkillSlug(keyword: string): string | null {
    const normalized = keyword.trim().toLowerCase();
    const found = SKILLS.find((s) => s.name.toLowerCase() === normalized || s.searchTerm.toLowerCase() === normalized || s.slug === normalized.replace(/[^a-z0-9]+/g, '-'));
    return found ? found.slug : null;
}
export default async function JobDetail({ job, canonicalPath, backHref, backLabel, }: {
    job: Job;
    canonicalPath: string;
    backHref: string;
    backLabel: string;
}) {
    const similarJobs = await getSimilarJobs(job.id, 6);
    const compensation = job.stipend || job.salary || null;
    const deadlineTime = job.deadline
        ? new Date(job.deadline).getTime()
        : null;
    const timeUntilDeadline = deadlineTime
        ? deadlineTime - Date.now()
        : null;
    const isDeadlineSoon = timeUntilDeadline !== null &&
        timeUntilDeadline > 0 &&
        timeUntilDeadline <
            1000 * 60 * 60 * 24 * 3;
    return (<main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">
          {job.source || 'unknown'} ·{' '}
          {job.posted_at
            ? new Date(job.posted_at).toLocaleDateString()
            : 'Recent'}
        </p>

        {job.type && (<span className="chip chip-muted text-[0.65rem]">
            {job.type}
          </span>)}
      </div>

      <div className="flex items-start justify-between gap-3">
        <JobBadges job={job} className="mt-3"/>
        <SaveJobButton job={job}/>
      </div>

      <h1 className="display mt-2 text-3xl font-medium">
        {job.title}
      </h1>

      <p className="mt-1 text-sm" style={{
            color: 'var(--ink-soft)',
        }}>
        <Link href={`/companies/${companySlug(job.company)}`} className="hover:underline" style={{ color: 'inherit' }}>
          {job.company}
        </Link>
        {job.location &&
            ` · ${job.location}`}
      </p>

      {compensation && (<p className="mt-2 text-sm font-medium" style={{
                color: 'var(--ink)',
            }}>
          {compensation}
        </p>)}

      {job.is_government && (job.department || job.vacancies || job.notification_number) && (<div className="panel mt-4 flex flex-col gap-1 p-4 text-sm" style={{ color: 'var(--ink-soft)' }}>
          {job.department && (<p>
              <span style={{ color: 'var(--ink)' }}>Department:</span> {job.department}
            </p>)}
          {job.vacancies && (<p>
              <span style={{ color: 'var(--ink)' }}>Vacancies:</span> {job.vacancies}
            </p>)}
          {job.notification_number && (<p>
              <span style={{ color: 'var(--ink)' }}>Notification No:</span>{' '}
              {job.notification_number}
            </p>)}
        </div>)}

      {isDeadlineSoon && (<p className="mt-2 text-sm font-medium" style={{
                color: 'var(--rust)',
            }}>
          Application deadline{' '}
          {new Date(job.deadline as string).toLocaleDateString()}{' '}
          — apply soon
        </p>)}

      <div className="mt-5">
        <MatchScoreBadge job={job} variant="detailed"/>
      </div>

      {job.enriched_overview && (<div className="mt-6">
          <p className="whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
            {job.enriched_overview}
          </p>

          {job.enriched_keywords && job.enriched_keywords.length > 0 && (<div className="mt-3 flex flex-wrap gap-1.5">
              {job.enriched_keywords.map((kw) => {
            const skillSlug = matchSkillSlug(kw);
            return skillSlug ? (<Link key={kw} href={`/skills/${skillSlug}`} className="chip chip-muted text-[0.65rem] hover:underline">
                    {kw}
                  </Link>) : (<span key={kw} className="chip chip-muted text-[0.65rem]">
                    {kw}
                  </span>);
        })}
            </div>)}
        </div>)}

      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed" style={{
            color: 'var(--ink-soft)',
        }}>
        {job.description}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {job.url ? (<ApplyButton url={job.url} jobId={job.id}/>) : (<a href="/login" className="btn btn-primary">
            Sign in to apply
          </a>)}

        <a href={backHref} className="btn">
          ← {backLabel}
        </a>
      </div>

      <SimilarJobs jobs={similarJobs}/>
    </main>);
}

// Module: app/components/JobDetail.tsx
// Defines component(s)/export(s): JobDetail
// Defines function(s): buildFallbackSummary
//
// JobPosting JSON-LD for this job is emitted once, at the page level (jobs/internships/
// remote-jobs/government-jobs [slug] pages via lib/structuredData.ts jobPostingSchema) —
// this component used to also render its own copy, which meant every job page shipped two
// separate, slightly inconsistent JobPosting blocks. Don't re-add schema here.

import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { getSimilarJobs } from '@/lib/jobs';
import { companySlug, getCompanyIntel } from '@/lib/companies';
import { jobPostedDate, formatPostedDate } from '@/lib/jobDates';
import { sourceLabel } from '@/lib/facets';
import { matchSkillSlug } from '@/lib/skillMatch';
import JobBadges from '@/app/components/JobBadges';
import ApplyButton from '@/app/components/ApplyButton';
import SimilarJobs from '@/app/components/SimilarJobs';
import SaveJobButton from '@/app/components/SaveJobButton';
import MatchScoreBadge from '@/app/components/MatchScoreBadge';
import StructuredDetails from '@/app/components/StructuredDetails';
import ExploreRelated from '@/app/components/ExploreRelated';
import JobFAQ from '@/app/components/JobFAQ';
import JobFactsTable from '@/app/components/JobFactsTable';
import { JobResponsibilities, JobPreparation } from '@/app/components/JobSections';
import JobCompanyAbout from '@/app/components/JobCompanyAbout';
import CompanyMoreJobs from '@/app/components/CompanyMoreJobs';
import SkillsBreakdown from '@/app/components/SkillsBreakdown';
import ApplicationTimeline from '@/app/components/ApplicationTimeline';
import ExperienceMeter from '@/app/components/ExperienceMeter';
import ApplyChecklist from '@/app/components/ApplyChecklist';

// matchSkillSlug moved to lib/skillMatch.ts so SkillsBreakdown.tsx can
// reuse the same keyword -> /skills/[slug] matching instead of
// duplicating it.
// PHASE 1 thin-content fix: some scraped postings carry only a couple of
// sentences of raw description and haven't been through the
// overview/structured enrichment passes yet (crawler/src/content_enrichment.py
// / structured_enrichment.py run async after ingest, so there's a window
// where a freshly-scraped job has neither). Rather than render a near-empty
// page in that window, fall back to a short templated summary built from
// fields we always have (title/company/location/type/compensation) —
// still true, still specific to the posting, never invented facts.
const THIN_DESCRIPTION_THRESHOLD = 220;
function buildFallbackSummary(job: Job): string | null {
    const hasRichContent = Boolean(job.enriched_overview) || Boolean(job.structured_description);
    const descriptionLength = (job.description ?? '').trim().length;
    if (hasRichContent || descriptionLength >= THIN_DESCRIPTION_THRESHOLD) return null;
    const typeLabel = job.type === 'internship' ? 'internship' : job.type === 'contract' ? 'contract role' : 'position';
    const locationClause = job.is_remote ? 'as a remote role' : job.location ? `in ${job.location}` : '';
    const compClause = job.stipend || job.salary ? ` Compensation: ${job.stipend || job.salary}.` : '';
    return `${job.company} is hiring for the ${job.title} ${typeLabel} ${locationClause}.${compClause} See the Education, Key Skills, and Notes below for the full eligibility breakdown, or use the Apply button to view the original listing for complete details.`.replace(/\s+/g, ' ').trim();
}
export default async function JobDetail({ job, canonicalPath, backHref, backLabel, }: {
    job: Job;
    canonicalPath: string;
    backHref: string;
    backLabel: string;
}) {
    const [similarJobs, companyIntel] = await Promise.all([getSimilarJobs(job.id, 6), getCompanyIntel(companySlug(job.company))]);
    const compensation = job.stipend || job.salary || null;
    // posted_at, else created_at: same rule as the JobPosting datePosted (lib/jobDates.ts).
    const postedDate = jobPostedDate(job);
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
    return (<article className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">
          {job.source ? sourceLabel(job.source) : null}
          {postedDate && (<>
              {job.source ? ' · ' : null}
              <time dateTime={postedDate}>Posted {formatPostedDate(postedDate)}</time>
            </>)}
        </p>

        {job.type && (<span className="chip chip-muted text-[0.65rem]">
            {job.type}
          </span>)}
      </div>

      <JobBadges job={job} className="mt-3"/>

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

      {/* Primary action above the fold: the Apply button sits directly under the title block. */}
      <div className="mt-5 flex flex-wrap items-center gap-3" id="apply">
        {job.url ? (<ApplyButton url={job.url} jobId={job.id}/>) : (<a href="/login" className="btn btn-primary">
            Sign in to apply
          </a>)}
        <SaveJobButton job={job}/>
      </div>

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

      <StructuredDetails job={job}/>
      <ExperienceMeter job={job}/>

      {(() => {
            const fallback = buildFallbackSummary(job);
            return fallback ? (<p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {fallback}
            </p>) : null;
        })()}

      <p className="mt-4 whitespace-pre-line text-sm leading-relaxed" style={{
            color: 'var(--ink-soft)',
        }}>
        {job.structured_description || job.description}
      </p>

      <JobResponsibilities job={job}/>
      <SkillsBreakdown job={job}/>
      <JobFactsTable job={job}/>
      <JobPreparation job={job}/>
      <ApplicationTimeline job={job}/>
      <ApplyChecklist job={job}/>
      <JobCompanyAbout company={job.company} intel={companyIntel}/>
      <JobFAQ job={job}/>
      <CompanyMoreJobs job={job}/>

      <ExploreRelated job={job} basePath={backHref}/>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {job.url ? (<ApplyButton url={job.url} jobId={job.id}/>) : (<a href="/login" className="btn btn-primary">
            Sign in to apply
          </a>)}

        <a href={backHref} className="btn">
          ← {backLabel}
        </a>
      </div>

      <SimilarJobs jobs={similarJobs}/>
    </article>);
}

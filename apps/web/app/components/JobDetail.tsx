import type { Job } from '@/lib/jobs';
import { BASE_URL } from '@/lib/jobs';
import AdSlot from '@/app/components/AdSlot';
import JobBadges from '@/app/components/JobBadges';

/**
 * Builds JobPosting structured data following Google's guidance
 * (https://developers.google.com/search/docs/appearance/structured-data/job-posting):
 *  - always include datePosted
 *  - include validThrough whenever we know a deadline, so Google can drop
 *    the rich result automatically once it passes instead of showing a
 *    stale posting
 *  - mark remote roles with jobLocationType / applicantLocationRequirements
 *  - include baseSalary when we have a parsed salary/stipend figure
 * Expired jobs never reach this component: the API only returns
 * is_active = true rows, and getJobById() returning null causes the caller
 * to render notFound() (a real 404), which is what Google recommends doing
 * for closed postings instead of leaving an indexable "this job is closed"
 * page live.
 */
function buildJobPostingSchema(job: Job, canonicalUrl: string) {
  const isRemote = /remote/i.test(job.location || '');

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.posted_at,
    employmentType: job.type === 'internship' ? 'INTERN' : 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(job.is_official_domain && job.apply_domain
        ? { sameAs: `https://${job.apply_domain}` }
        : {}),
    },
    url: canonicalUrl,
    directApply: false,
  };

  if (job.deadline) {
    schema.validThrough = job.deadline;
  }

  if (isRemote) {
    schema.jobLocationType = 'TELECOMMUTE';
    schema.applicantLocationRequirements = {
      '@type': 'Country',
      name: 'IN',
    };
  } else if (job.location) {
    schema.jobLocation = {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.location,
        addressCountry: 'IN',
      },
    };
  }

  const compensationText = job.stipend || job.salary;
  const compensationValue = compensationText ? parseFirstNumber(compensationText) : null;

  if (compensationValue) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        value: compensationValue,
        unitText: /year|annum|lpa/i.test(compensationText || '') ? 'YEAR' : 'MONTH',
      },
    };
  }

  return schema;
}

function parseFirstNumber(text: string): number | null {
  const match = text.replace(/,/g, '').match(/[\d.]+/);
  return match ? Number(match[0]) : null;
}

export default function JobDetail({
  job,
  canonicalPath,
  backHref,
  backLabel,
}: {
  job: Job;
  canonicalPath: string;
  backHref: string;
  backLabel: string;
}) {
  const compensation = job.stipend || job.salary || null;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const jobPostingSchema = buildJobPostingSchema(job, canonicalUrl);

  const isDeadlineSoon =
    !!job.deadline &&
    new Date(job.deadline).getTime() - Date.now() > 0 &&
    new Date(job.deadline).getTime() - Date.now() < 1000 * 60 * 60 * 24 * 3;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingSchema),
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">
          {job.source || 'unknown'} ·{' '}
          {job.posted_at ? new Date(job.posted_at).toLocaleDateString() : 'Recent'}
        </p>

        {job.type && <span className="chip chip-muted text-[0.65rem]">{job.type}</span>}
      </div>

      <JobBadges job={job} className="mt-3" />

      <h1 className="display mt-2 text-3xl font-medium">{job.title}</h1>

      <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
        {job.company}
        {job.location && ` · ${job.location}`}
      </p>

      {compensation && (
        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--ink)' }}>
          {compensation}
        </p>
      )}

      {isDeadlineSoon && (
        <p className="mt-2 text-sm font-medium" style={{ color: 'var(--rust)' }}>
          Application deadline {new Date(job.deadline as string).toLocaleDateString()} — apply soon
        </p>
      )}

      <p className="mt-6 whitespace-pre-line text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {job.description}
      </p>

      <AdSlot slot="1083783857" format="autorelaxed" className="mt-8" />

      <div className="mt-8 flex gap-3">
        {job.url ? (
          <a href={job.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary">
            Apply now
          </a>
        ) : (
          <a href="/register" className="btn btn-primary">
            Sign up to apply
          </a>
        )}

        <a href={backHref} className="btn">
          ← {backLabel}
        </a>
      </div>
    </main>
  );
}

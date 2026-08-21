import type { Job } from '@/lib/jobs';
import { BASE_URL, getSimilarJobs } from '@/lib/jobs';
import JobBadges from '@/app/components/JobBadges';
import ApplyButton from '@/app/components/ApplyButton';
import SimilarJobs from '@/app/components/SimilarJobs';

/**
 * Builds JobPosting structured data following Google's
 * JobPosting structured data guidance.
 *
 * - Always include datePosted
 * - Include validThrough when a deadline exists
 * - Mark remote roles using jobLocationType
 * - Include baseSalary when salary/stipend can be parsed
 */
function buildJobPostingSchema(job: Job, canonicalUrl: string) {
  const isRemote = /remote/i.test(job.location || '');

  // Lead with the AI-generated overview (see migration 017) when present —
  // it's original, role-specific prose, vs. the raw scraped description
  // which is often thin/boilerplate and shared near-verbatim across many
  // listings from the same source board.
  const schemaDescription = job.enriched_overview
    ? `${job.enriched_overview}\n\n${job.description || ''}`.trim()
    : job.description;

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: schemaDescription,
    datePosted: job.posted_at,
    employmentType:
      job.type === 'internship' ? 'INTERN' : 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
      ...(job.is_official_domain && job.apply_domain
        ? {
            sameAs: `https://${job.apply_domain}`,
          }
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
      name: job.country && job.country !== 'Worldwide' ? job.country : 'IN',
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

  const compensationValue = compensationText
    ? parseFirstNumber(compensationText)
    : null;

  if (compensationValue) {
    schema.baseSalary = {
      '@type': 'MonetaryAmount',
      currency: 'INR',
      value: {
        '@type': 'QuantitativeValue',
        value: compensationValue,
        unitText: /year|annum|lpa/i.test(
          compensationText || ''
        )
          ? 'YEAR'
          : 'MONTH',
      },
    };
  }

  return schema;
}

function parseFirstNumber(text: string): number | null {
  const match = text
    .replace(/,/g, '')
    .match(/[\d.]+/);

  return match ? Number(match[0]) : null;
}

export default async function JobDetail({
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
  const similarJobs = await getSimilarJobs(job.id, 6);

  const compensation =
    job.stipend || job.salary || null;

  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  const jobPostingSchema = buildJobPostingSchema(
    job,
    canonicalUrl
  );

  const deadlineTime = job.deadline
    ? new Date(job.deadline).getTime()
    : null;

  const timeUntilDeadline = deadlineTime
    ? deadlineTime - Date.now()
    : null;

  const isDeadlineSoon =
    timeUntilDeadline !== null &&
    timeUntilDeadline > 0 &&
    timeUntilDeadline <
      1000 * 60 * 60 * 24 * 3;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingSchema),
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">
          {job.source || 'unknown'} ·{' '}
          {job.posted_at
            ? new Date(
                job.posted_at
              ).toLocaleDateString()
            : 'Recent'}
        </p>

        {job.type && (
          <span className="chip chip-muted text-[0.65rem]">
            {job.type}
          </span>
        )}
      </div>

      <JobBadges
        job={job}
        className="mt-3"
      />

      <h1 className="display mt-2 text-3xl font-medium">
        {job.title}
      </h1>

      <p
        className="mt-1 text-sm"
        style={{
          color: 'var(--ink-soft)',
        }}
      >
        {job.company}
        {job.location &&
          ` · ${job.location}`}
      </p>

      {compensation && (
        <p
          className="mt-2 text-sm font-medium"
          style={{
            color: 'var(--ink)',
          }}
        >
          {compensation}
        </p>
      )}

      {job.is_government && (job.department || job.vacancies || job.notification_number) && (
        <div
          className="panel mt-4 flex flex-col gap-1 p-4 text-sm"
          style={{ color: 'var(--ink-soft)' }}
        >
          {job.department && (
            <p>
              <span style={{ color: 'var(--ink)' }}>Department:</span> {job.department}
            </p>
          )}
          {job.vacancies && (
            <p>
              <span style={{ color: 'var(--ink)' }}>Vacancies:</span> {job.vacancies}
            </p>
          )}
          {job.notification_number && (
            <p>
              <span style={{ color: 'var(--ink)' }}>Notification No:</span>{' '}
              {job.notification_number}
            </p>
          )}
        </div>
      )}

      {isDeadlineSoon && (
        <p
          className="mt-2 text-sm font-medium"
          style={{
            color: 'var(--rust)',
          }}
        >
          Application deadline{' '}
          {new Date(
            job.deadline as string
          ).toLocaleDateString()}{' '}
          — apply soon
        </p>
      )}

      {job.enriched_overview && (
        <div className="mt-6">
          <p
            className="whitespace-pre-line text-sm leading-relaxed"
            style={{ color: 'var(--ink)' }}
          >
            {job.enriched_overview}
          </p>

          {job.enriched_keywords && job.enriched_keywords.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {job.enriched_keywords.map((kw) => (
                <span key={kw} className="chip chip-muted text-[0.65rem]">
                  {kw}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      <p
        className="mt-4 whitespace-pre-line text-sm leading-relaxed"
        style={{
          color: 'var(--ink-soft)',
        }}
      >
        {job.description}
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {job.url ? (
          <ApplyButton
            url={job.url}
            jobId={job.id}
          />
        ) : (
          <a
            href="/login"
            className="btn btn-primary"
          >
            Sign in to apply
          </a>
        )}

        <a
          href={backHref}
          className="btn"
        >
          ← {backLabel}
        </a>
      </div>

      <SimilarJobs jobs={similarJobs} />
    </main>
  );
}
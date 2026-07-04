import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import JobDetail from '@/app/components/JobDetail';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const job = await getJobById(jobIdFromSlug(params.slug));

  if (!job) return {};

  return {
    title: `${job.title} at ${job.company} | InternFlow`,
    description: `Apply for ${job.title} at ${job.company}${
      job.location ? ` in ${job.location}` : ''
    }. View eligibility, skills, stipend/salary, and application details.`,
    alternates: {
      // /jobs/[slug] is the single canonical detail URL for every posting,
      // internship or not. /internships/[slug] renders the same content for
      // internship-type jobs (useful, contextual URL for visitors arriving
      // from the internships hub) but canonicalizes back here, so the two
      // URLs never compete as duplicate content.
      canonical: `${BASE_URL}/jobs/${params.slug}`,
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const job = await getJobById(jobIdFromSlug(params.slug));

  // Expired / deactivated jobs return null here (API filters is_active =
  // true) — a real 404 rather than an indexable "no longer accepting
  // applications" page, per Google's JobPosting guidance for closed roles.
  if (!job) notFound();

  return (
    <JobDetail
      job={job}
      canonicalPath={`/jobs/${params.slug}`}
      backHref="/jobs"
      backLabel="Back to listings"
    />
  );
}

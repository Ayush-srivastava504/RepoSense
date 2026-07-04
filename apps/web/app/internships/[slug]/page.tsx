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

  if (!job || job.type !== 'internship') return {};

  return {
    title: `${job.title} at ${job.company} — Internship | InternFlow`,
    description: `Apply for the ${job.title} internship at ${job.company}${
      job.location ? ` in ${job.location}` : ''
    }. View eligibility, skills, stipend, and application details.`,
    alternates: {
      // Canonicalize to the single /jobs/[slug] detail URL so this page and
      // /jobs/[slug] are never treated as duplicate content — see the note
      // in app/jobs/[slug]/page.tsx.
      canonical: `${BASE_URL}/jobs/${params.slug}`,
    },
  };
}

export default async function InternshipDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const job = await getJobById(jobIdFromSlug(params.slug));

  // Only internship-type postings live at this URL. A non-internship job
  // (or an inactive/expired one) 404s here — its real home is /jobs/[slug].
  if (!job || job.type !== 'internship') notFound();

  return (
    <JobDetail
      job={job}
      canonicalPath={`/jobs/${params.slug}`}
      backHref="/internships"
      backLabel="Back to internships"
    />
  );
}

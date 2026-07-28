import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';

import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import { jobPostingSchema, breadcrumbSchema } from '@/lib/structuredData';
import JobDetail from '@/app/components/JobDetail';
import TrackView from '@/app/components/TrackView';

export const dynamic = 'force-dynamic';

const NATIVE_AD_CONTAINER =
  'container-0ecc31c4385791c7fa0bcc3db25e36c9';

export async function generateMetadata({
  params,
}: {
  params: {
    slug: string;
  };
}): Promise<Metadata> {
  const job = await getJobById(jobIdFromSlug(params.slug));

  if (!job) {
    return {};
  }

  return {
    title: `${job.title} at ${job.company} — Job | InternFlow`,
    description: `Apply for ${job.title} at ${job.company}${
      job.location ? ` in ${job.location}` : ''
    }. View eligibility, skills, salary, and application details.`,
    alternates: {
      canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const job = await getJobById(jobIdFromSlug(params.slug));

  if (!job) {
    notFound();
  }

  const canonicalPath = canonicalPathForJob(job);
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const jobSchema = jobPostingSchema(job, canonicalUrl);
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Jobs', url: `${BASE_URL}/jobs` },
    { name: job.title, url: canonicalUrl },
  ]);

  return (
    <main className="w-full">
      <Script
        id="job-posting-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobSchema) }}
      />
      <Script
        id="job-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <TrackView
        event="job_view"
        params={{ job_id: job.id, job_title: job.title, company: job.company }}
      />

      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail
          job={job}
          canonicalPath={canonicalPath}
          backHref="/jobs"
          backLabel="Back to jobs"
        />
      </div>

      <section className="mx-auto w-full max-w-3xl px-3 pb-8 sm:px-4 sm:pb-12">
        <div className="w-full overflow-hidden rounded-lg">
          <div id={NATIVE_AD_CONTAINER} />
        </div>
      </section>

      <Script
        id="job-detail-native-banner"
        async
        data-cfasync="false"
        src="https://pl30201817.effectivecpmnetwork.com/0ecc31c4385791c7fa0bcc3db25e36c9/invoke.js"
        strategy="afterInteractive"
      />
    </main>
  );
}
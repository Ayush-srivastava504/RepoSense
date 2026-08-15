import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';

import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import { jobPostingSchema, breadcrumbSchema } from '@/lib/structuredData';
import JobDetail from '@/app/components/JobDetail';

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

  if (!job || !job.is_remote) {
    return {};
  }

  return {
    title: `${job.title} at ${job.company} — Remote | InternFlow`,
    description: `Apply for the remote ${job.title} role at ${job.company}${
      job.location ? ` (${job.location})` : ''
    }. View skills, compensation, and application details.`,
    alternates: {
      canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
    },
  };
}

export default async function RemoteJobDetailPage({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const job = await getJobById(jobIdFromSlug(params.slug));

  if (!job || !job.is_remote) {
    notFound();
  }

  const canonicalPath = canonicalPathForJob(job);
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;

  return (
    <main className="w-full">
      <Script
        id="remote-job-posting-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema(job, canonicalUrl)) }}
      />
      <Script
        id="remote-job-breadcrumb-schema"
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            breadcrumbSchema([
              { name: 'Home', url: BASE_URL },
              { name: 'Remote Jobs', url: `${BASE_URL}/remote-jobs` },
              { name: job.title, url: canonicalUrl },
            ])
          ),
        }}
      />
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail
          job={job}
          canonicalPath={canonicalPath}
          backHref="/remote-jobs"
          backLabel="Back to remote jobs"
        />
      </div>

      <section className="mx-auto w-full max-w-3xl px-3 pb-8 sm:px-4 sm:pb-12">
        <div className="w-full overflow-hidden rounded-lg">
          <div id={NATIVE_AD_CONTAINER} />
        </div>
      </section>

      <Script
        id="remote-job-detail-native-banner"
        async
        data-cfasync="false"
        src="https://pl30201817.effectivecpmnetwork.com/0ecc31c4385791c7fa0bcc3db25e36c9/invoke.js"
        strategy="afterInteractive"
      />
    </main>
  );
}

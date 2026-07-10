import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';

import { jobIdFromSlug } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import JobDetail from '@/app/components/JobDetail';

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

  if (!job || !job.is_remote) {
    return {};
  }

  return {
    title: `${job.title} at ${job.company} — Remote | InternFlow`,
    description: `Apply for the remote ${job.title} role at ${job.company}${
      job.location ? ` (${job.location})` : ''
    }. View skills, compensation, and application details.`,
    alternates: {
      canonical: `${BASE_URL}/remote-jobs/${params.slug}`,
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

  return (
    <main className="w-full">
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail
          job={job}
          canonicalPath={`/remote-jobs/${params.slug}`}
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

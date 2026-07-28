import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';

import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
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

  if (!job || !job.is_government) {
    return {};
  }

  return {
    title: `${job.title}${job.department ? ` — ${job.department}` : ''} | InternFlow`,
    description: `${job.department ? `${job.department} recruitment: ` : ''}${job.title}${
      job.vacancies ? `. ${job.vacancies} vacancies.` : '.'
    } View eligibility, notification details, and the official application link.`,
    alternates: {
      canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
    },
  };
}

export default async function GovernmentJobDetailPage({
  params,
}: {
  params: {
    slug: string;
  };
}) {
  const job = await getJobById(jobIdFromSlug(params.slug));

  if (!job || !job.is_government) {
    notFound();
  }

  return (
    <main className="w-full">
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail
          job={job}
          canonicalPath={canonicalPathForJob(job)}
          backHref="/government-jobs"
          backLabel="Back to government jobs"
        />
      </div>

      <section className="mx-auto w-full max-w-3xl px-3 pb-8 sm:px-4 sm:pb-12">
        <div className="w-full overflow-hidden rounded-lg">
          <div id={NATIVE_AD_CONTAINER} />
        </div>
      </section>

      <Script
        id="government-job-detail-native-banner"
        async
        data-cfasync="false"
        src="https://pl30201817.effectivecpmnetwork.com/0ecc31c4385791c7fa0bcc3db25e36c9/invoke.js"
        strategy="afterInteractive"
      />
    </main>
  );
}

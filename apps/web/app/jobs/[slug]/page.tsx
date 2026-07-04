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

  if (!job) {
    return {};
  }

  return {
    title: `${job.title} at ${job.company} — Job | InternFlow`,
    description: `Apply for ${job.title} at ${job.company}${
      job.location ? ` in ${job.location}` : ''
    }. View eligibility, skills, salary, and application details.`,
    alternates: {
      canonical: `${BASE_URL}/jobs/${params.slug}`,
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

  return (
    <>
      {/* Monetag Vignette */}
      <Script
        id="job-detail-vignette"
        strategy="afterInteractive"
      >
        {`
          (function(s) {
            s.dataset.zone = '11238201';
            s.src = 'https://n6wxm.com/vignette.min.js';
          })(
            [document.documentElement, document.body]
              .filter(Boolean)
              .pop()
              .appendChild(document.createElement('script'))
          );
        `}
      </Script>

      <div className="px-3 sm:px-4">
        <JobDetail
          job={job}
          canonicalPath={`/jobs/${params.slug}`}
          backHref="/jobs"
          backLabel="Back to jobs"
        />
      </div>

      {/* Native Banner */}
      <section className="mx-auto w-full max-w-3xl px-3 sm:px-4 pb-8 sm:pb-12">
        <div
          className="w-full overflow-hidden rounded-lg"
          style={{
            minHeight: '70px',
          }}
        >
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
    </>
  );
}
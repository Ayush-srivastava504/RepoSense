// Module: app/government-jobs/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, GovernmentJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import { jobPostingSchema, breadcrumbSchema } from '@/lib/structuredData';
import JobDetail from '@/app/components/JobDetail';
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || !job.is_government) {
        return {};
    }
    return {
        title: `${job.title}${job.department ? ` — ${job.department}` : ''}`,
        description: `${job.department ? `${job.department} recruitment: ` : ''}${job.title}${job.vacancies ? `. ${job.vacancies} vacancies.` : '.'} View eligibility, notification details, and the official application link.`,
        alternates: {
            canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
        },
    };
}
export default async function GovernmentJobDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || !job.is_government) {
        notFound();
    }
    const canonicalPath = canonicalPathForJob(job);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    return (<main className="w-full">
      <Script id="government-job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema(job, canonicalUrl)) }}/>
      <Script id="government-job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(breadcrumbSchema([
                { name: 'Home', url: BASE_URL },
                { name: 'Government Jobs', url: `${BASE_URL}/government-jobs` },
                { name: job.title, url: canonicalUrl },
            ])),
        }}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/government-jobs" backLabel="Back to government jobs"/>
      </div>
    </main>);
}

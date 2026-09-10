// Module: app/remote-jobs/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, RemoteJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import {  jobPostingSchema, breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import JobDetail from '@/app/components/JobDetail';
import Breadcrumbs from '@/app/components/Breadcrumbs';
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || !job.is_remote) {
        return {};
    }
    return {
        title: `${job.title} at ${job.company} — Remote`,
        description: `Apply for the remote ${job.title} role at ${job.company}${job.location ? ` (${job.location})` : ''}. View skills, compensation, and application details.`,
        alternates: {
            canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
            languages: languageAlternates(canonicalPathForJob(job)),
        },
    };
}
export default async function RemoteJobDetailPage({ params, }: {
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
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Remote Jobs', url: `${BASE_URL}/remote-jobs` },
        { name: job.title, url: canonicalUrl },
    ]);
    return (<main className="w-full">
      <script id="remote-job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema(job, canonicalUrl)) }}/>
      <script id="remote-job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(crumbs),
        }}/>
      <Breadcrumbs schema={crumbs}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/remote-jobs" backLabel="Back to remote jobs"/>
      </div>
    </main>);
}

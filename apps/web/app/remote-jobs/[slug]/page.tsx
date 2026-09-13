// Module: app/remote-jobs/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, RemoteJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { jobIdFromSlug, canonicalCategoryForJob, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import {  jobPostingSchema, breadcrumbSchema, languageAlternates, jobOpenGraphMeta } from '@/lib/structuredData';
import JobDetail from '@/app/components/JobDetail';
import Breadcrumbs from '@/app/components/Breadcrumbs';
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const job = await getJobById(jobIdFromSlug(params.slug));
    // Metadata should only ever describe this URL's canonical category — a job
    // that's actually government/internship (which outrank "remote" in
    // canonicalCategoryForJob) gets its real title/description from the page
    // it redirects to, not a "— Remote" title here.
    if (!job || !job.is_remote || canonicalCategoryForJob(job) !== 'remote-jobs') {
        return {};
    }
    const title = `${job.title} at ${job.company} — Remote`;
    const description = `Apply for the remote ${job.title} role at ${job.company}${job.location ? ` (${job.location})` : ''}. View skills, compensation, and application details.`;
    const canonicalUrl = `${BASE_URL}${canonicalPathForJob(job)}`;
    return {
        title,
        description,
        alternates: {
            canonical: canonicalUrl,
            languages: languageAlternates(canonicalPathForJob(job)),
        },
        ...jobOpenGraphMeta({ title, description, url: canonicalUrl, imageAlt: `${job.title} at ${job.company}` }),
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
    // A remote job that's ALSO government or an internship must not render a
    // second full page here — government-jobs/internships outrank "remote" in
    // canonicalCategoryForJob, so this URL would otherwise duplicate-content
    // against the real canonical page (the exact bug already fixed on
    // /jobs/[slug] — this route was checking only its own is_remote flag
    // instead of deferring to the same priority order).
    if (canonicalCategoryForJob(job) !== 'remote-jobs') {
        permanentRedirect(canonicalPathForJob(job));
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

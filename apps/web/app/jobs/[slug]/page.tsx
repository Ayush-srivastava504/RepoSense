// Module: app/jobs/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, JobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { jobIdFromSlug, canonicalCategoryForJob, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import {  jobPostingSchema, breadcrumbSchema, safeJsonLd } from '@/lib/structuredData';
import { buildJobTitle, truncateDescription, isIndexableJob } from '@/lib/seo/seoMetrics';
import { jobOgImageUrl } from '@/lib/seo/ogImage';
import JobDetail from '@/app/components/JobDetail';
import TrackView from '@/app/components/TrackView';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job) {
        return {};
    }
    const title = buildJobTitle({
        title: job.title,
        company: job.company,
        type: job.type,
        location: job.location,
        isRemote: job.is_remote,
    });
    const rawDescription = job.enriched_overview ||
        `Apply for ${job.title} at ${job.company}${job.location ? ` in ${job.location}` : ''}. View eligibility, skills, salary, and application details.`;
    const description = truncateDescription(rawDescription);
    const ogImage = jobOgImageUrl(job);
    return {
        title,
        description,
        alternates: {
            canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
        },
        openGraph: {
            type: 'website',
            url: `${BASE_URL}${canonicalPathForJob(job)}`,
            title,
            description,
            images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: [ogImage],
        },
        // Defense in depth alongside the JobPosting schema's validThrough:
        // Search Console can take days to re-crawl and honor a stale
        // validThrough, so this header/meta noindex acts immediately on
        // the next crawl instead of waiting for schema-driven cleanup.
        ...(!isIndexableJob(job)
            ? { robots: { index: false, follow: true } }
            : {}),
    };
}
export default async function JobDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job) {
        notFound();
    }
    // A job whose true category isn't 'jobs' (internship / remote / government)
    // must not render a second, fully-formed page here — that's what was
    // producing duplicate 200-OK pages with a canonical pointing elsewhere.
    // Redirect to the real canonical URL instead of just declaring it in
    // <link rel="canonical">.
    if (canonicalCategoryForJob(job) !== 'jobs') {
        permanentRedirect(canonicalPathForJob(job));
    }
    const canonicalPath = canonicalPathForJob(job);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const jobSchema = jobPostingSchema(job, canonicalUrl);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Jobs', url: `${BASE_URL}/jobs` },
        { name: job.title, url: canonicalUrl },
    ]);
    return (<main className="w-full">
      <script id="job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jobSchema) }}/>
      <script id="job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="job_view" params={{ job_id: job.id, job_title: job.title, company: job.company }}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/jobs" backLabel="Back to jobs"/>
      </div>
    </main>);
}

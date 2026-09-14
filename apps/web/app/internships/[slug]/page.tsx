// Module: app/internships/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, InternshipDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { getJobById, BASE_URL } from '@/lib/jobs';
import {  jobPostingSchema, breadcrumbSchema, languageAlternates, safeJsonLd } from '@/lib/structuredData';
import { buildJobTitle, truncateDescription, isStaleForIndexing } from '@/lib/seo/seoMetrics';
import JobDetail from '@/app/components/JobDetail';
import Breadcrumbs from '@/app/components/Breadcrumbs';
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || job.type !== 'internship') {
        return {};
    }
    const title = buildJobTitle({
        title: job.title,
        company: job.company,
        type: 'internship',
        location: job.location,
        isRemote: job.is_remote,
    });
    const rawDescription = job.enriched_overview ||
        `Apply for the ${job.title} internship at ${job.company}${job.location ? ` in ${job.location}` : ''}. View eligibility, skills, stipend, and application details.`;
    return {
        title,
        description: truncateDescription(rawDescription),
        alternates: {
            canonical: `${BASE_URL}${canonicalPathForJob(job)}`,
            languages: languageAlternates(canonicalPathForJob(job)),
        },
        ...(isStaleForIndexing(job) ? { robots: { index: false, follow: true } } : {}),
    };
}
export default async function InternshipDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || job.type !== 'internship') {
        notFound();
    }
    const canonicalPath = canonicalPathForJob(job);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Internships', url: `${BASE_URL}/internships` },
        { name: job.title, url: canonicalUrl },
    ]);
    return (<main className="w-full">
      <script id="internship-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jobPostingSchema(job, canonicalUrl)) }}/>
      <script id="internship-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(crumbs),
        }}/>
      <Breadcrumbs schema={crumbs}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/internships" backLabel="Back to internships"/>
      </div>
    </main>);
}

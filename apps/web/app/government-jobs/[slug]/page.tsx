// Module: app/government-jobs/[slug]/page.tsx
// Defines component(s)/export(s): GovernmentJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug, canonicalPathForJob } from '@/lib/slug';
import { BASE_URL } from '@/lib/jobs';
import { getLocalizedJob, localizedCanonicalPath, jobLanguageAlternates } from '@/lib/jobLocale';
import {  jobPostingSchema, breadcrumbSchema, safeJsonLd } from '@/lib/structuredData';
import { truncateTitleForSerp, truncateDescription, isIndexableJob } from '@/lib/seo/seoMetrics';
import { jobOgImageUrl } from '@/lib/seo/ogImage';
import JobDetail from '@/app/components/JobDetail';
import Breadcrumbs from '@/app/components/Breadcrumbs';
export async function generateMetadata({ params, }: {
    params: {
        slug: string;
    };
}): Promise<Metadata> {
    const content = await getLocalizedJob(jobIdFromSlug(params.slug));
    const { job } = content;
    if (!job || !job.is_government) {
        return {};
    }
    const title = truncateTitleForSerp(`${job.title}${job.department ? ` — ${job.department}` : ''}`);
    const rawDescription = `${job.department ? `${job.department} recruitment: ` : ''}${job.title}${job.vacancies ? `. ${job.vacancies} vacancies.` : '.'} View eligibility, notification details, and the official application link.`;
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    return {
        title,
        description: truncateDescription(rawDescription),
        alternates: {
            canonical: `${BASE_URL}${canonicalPath}`,
            languages: jobLanguageAlternates(canonicalPathForJob(job), job.translated_locales),
        },
        openGraph: {
            type: 'website',
            url: `${BASE_URL}${canonicalPath}`,
            title,
            description: truncateDescription(rawDescription),
            images: [{ url: jobOgImageUrl(job), width: 1200, height: 630, alt: title }],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description: truncateDescription(rawDescription),
            images: [jobOgImageUrl(job)],
        },
        ...(!isIndexableJob(job) ? { robots: { index: false, follow: true } } : {}),
    };
}
export default async function GovernmentJobDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const content = await getLocalizedJob(jobIdFromSlug(params.slug));
    const { job } = content;
    if (!job || !job.is_government) {
        notFound();
    }
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Government Jobs', url: `${BASE_URL}/government-jobs` },
        { name: job.title, url: canonicalUrl },
    ]);
    return (<main className="w-full">
      <script id="government-job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jobPostingSchema(job, canonicalUrl)) }}/>
      <script id="government-job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(crumbs),
        }}/>
      <Breadcrumbs schema={crumbs}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/government-jobs" backLabel="Back to government jobs"/>
      </div>
    </main>);
}

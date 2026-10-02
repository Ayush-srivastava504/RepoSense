// Module: app/government-jobs/[slug]/page.tsx
// Defines component(s)/export(s): GovernmentJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { jobIdFromSlug, canonicalCategoryForJob, canonicalPathForJob } from '@/lib/slug';
import { BASE_URL } from '@/lib/jobs';
import { buildJobFaq } from '@/lib/jobFaq';
import { getLocalizedJob, localizedCanonicalPath, jobLanguageAlternates } from '@/lib/jobLocale';
import {  jobPostingSchema, breadcrumbSchema, faqSchema, safeJsonLd } from '@/lib/structuredData';
import { truncateTitleForSerp, truncateDescription, isIndexableJob, SERP_TITLE_PX_WITH_BRAND } from '@/lib/seo/seoMetrics';
import { pageOpenGraph } from '@/lib/seo/pageMeta';
import { jobOgImageUrl } from '@/lib/seo/ogImage';
import JobDetail from '@/app/components/JobDetail';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import TrackView from '@/app/components/TrackView';
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
    // layout.tsx appends ' | InternFlow' after this; reserve its width so the SERP title isn't cut off.
    const title = truncateTitleForSerp(`${job.title}${job.department ? ` — ${job.department}` : ''}`, SERP_TITLE_PX_WITH_BRAND);
    const rawDescription = `${job.department ? `${job.department} recruitment: ` : ''}${job.title}${job.vacancies ? `. ${job.vacancies} vacancies.` : '.'} View eligibility, notification details, and the official application link.`;
    const description = truncateDescription(rawDescription);
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    return {
        title,
        description,
        alternates: {
            canonical: `${BASE_URL}${canonicalPath}`,
            languages: jobLanguageAlternates(canonicalPathForJob(job), job.translated_locales),
        },
        ...pageOpenGraph({ title, description, url: `${BASE_URL}${canonicalPath}`, image: jobOgImageUrl(job), imageAlt: title }),
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
    // A job whose true category is another section (e.g. a remote internship, or a government internship)
    // must 308 to its canonical URL, like /jobs/[slug] does. Without this the same job answered 200 here
    // with a canonical pointing elsewhere: a duplicate page for Google to sort out.
    if (canonicalCategoryForJob(job) !== 'government-jobs') {
        permanentRedirect(canonicalPathForJob(job));
    }
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const postingSchema = jobPostingSchema(job, canonicalUrl);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Government Jobs', url: `${BASE_URL}/government-jobs` },
        { name: job.title, url: canonicalUrl },
    ]);
    const faqItems = buildJobFaq(job);
    const faq = faqItems.length > 0 ? faqSchema(faqItems) : null;
    return (<main className="w-full">
      {postingSchema && (<script id="government-job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(postingSchema) }}/>)}
      <script id="government-job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      {faq && (<script id="government-job-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faq) }}/>)}
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="job_view" params={{ job_id: job.id, job_title: job.title, company: job.company }}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/government-jobs" backLabel="Back to government jobs"/>
      </div>
    </main>);
}

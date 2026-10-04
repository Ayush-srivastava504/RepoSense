// Module: app/remote-jobs/[slug]/page.tsx
// Defines component(s)/export(s): RemoteJobDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { jobIdFromSlug, jobSlug, canonicalCategoryForJob, canonicalPathForJob } from '@/lib/slug';
import { BASE_URL } from '@/lib/jobs';
import { buildJobFaq } from '@/lib/jobFaq';
import { getLocalizedJob, localizedCanonicalPath, jobLanguageAlternates } from '@/lib/jobLocale';
import {  jobPostingSchema, breadcrumbSchema, faqSchema, safeJsonLd } from '@/lib/structuredData';
import { buildJobTitle, truncateDescription, isIndexableJob, SERP_TITLE_PX_WITH_BRAND, TITLE_MAX_CHARS_WITH_BRAND } from '@/lib/seo/seoMetrics';
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
    if (!job || !job.is_remote) {
        return {};
    }
    const title = buildJobTitle({
        title: job.title,
        company: job.company,
        type: job.type,
        isRemote: true,
        // layout.tsx appends ' | InternFlow' after this; reserve its width so the SERP title isn't cut off.
        maxPx: SERP_TITLE_PX_WITH_BRAND,
        maxChars: TITLE_MAX_CHARS_WITH_BRAND,
    });
    const rawDescription = job.enriched_overview ||
        `Apply for the remote ${job.title} role at ${job.company}${job.location ? ` (${job.location})` : ''}. View skills, compensation, and application details.`;
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
export default async function RemoteJobDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const content = await getLocalizedJob(jobIdFromSlug(params.slug));
    const { job } = content;
    if (!job || !job.is_remote) {
        notFound();
    }
    // A job whose true category is another section (e.g. a remote internship, or a government internship)
    // must 308 to its canonical URL, like /jobs/[slug] does. Without this the same job answered 200 here
    // with a canonical pointing elsewhere: a duplicate page for Google to sort out.
    if (canonicalCategoryForJob(job) !== 'remote-jobs') {
        permanentRedirect(canonicalPathForJob(job));
    }
    // Any slug that is not exactly the canonical one (stale title/city/pay in an old indexed URL, wrong case,
    // or a made-up prefix before a real id) 308s to it, so one job has exactly one URL.
    if (params.slug !== jobSlug(job)) {
        permanentRedirect(localizedCanonicalPath(canonicalPathForJob(job), content));
    }
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const postingSchema = jobPostingSchema(job, canonicalUrl);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Remote Jobs', url: `${BASE_URL}/remote-jobs` },
        { name: job.title, url: canonicalUrl },
    ]);
    const faqItems = buildJobFaq(job);
    const faq = faqItems.length > 0 ? faqSchema(faqItems) : null;
    return (<main className="w-full">
      {postingSchema && (<script id="remote-job-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(postingSchema) }}/>)}
      <script id="remote-job-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      {faq && (<script id="remote-job-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faq) }}/>)}
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="job_view" params={{ job_id: job.id, job_title: job.title, company: job.company }}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/remote-jobs" backLabel="Back to remote jobs"/>
      </div>
    </main>);
}

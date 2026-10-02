// Module: app/internships/[slug]/page.tsx
// Defines component(s)/export(s): InternshipDetailPage
// Defines function(s): generateMetadata
//

import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { jobIdFromSlug, canonicalCategoryForJob, canonicalPathForJob } from '@/lib/slug';
import { BASE_URL } from '@/lib/jobs';
import { buildJobFaq } from '@/lib/jobFaq';
import { getLocalizedJob, localizedCanonicalPath, jobLanguageAlternates } from '@/lib/jobLocale';
import {  jobPostingSchema, breadcrumbSchema, faqSchema, safeJsonLd } from '@/lib/structuredData';
import { pageOpenGraph } from '@/lib/seo/pageMeta';
import { buildJobTitle, truncateDescription, isIndexableJob, SERP_TITLE_PX_WITH_BRAND } from '@/lib/seo/seoMetrics';
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
    if (!job || job.type !== 'internship') {
        return {};
    }
    const title = buildJobTitle({
        title: job.title,
        company: job.company,
        type: 'internship',
        location: job.location,
        isRemote: job.is_remote,
        // layout.tsx appends ' | InternFlow' after this; reserve its width so the SERP title isn't cut off.
        maxPx: SERP_TITLE_PX_WITH_BRAND,
    });
    const rawDescription = job.enriched_overview ||
        `Apply for the ${job.title} internship at ${job.company}${job.location ? ` in ${job.location}` : ''}. View eligibility, skills, stipend, and application details.`;
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    return {
        title,
        description: truncateDescription(rawDescription),
        alternates: {
            canonical: `${BASE_URL}${canonicalPath}`,
            languages: jobLanguageAlternates(canonicalPathForJob(job), job.translated_locales),
        },
        ...pageOpenGraph({ title, description: truncateDescription(rawDescription), url: `${BASE_URL}${canonicalPath}`, image: jobOgImageUrl(job), imageAlt: title }),
        ...(!isIndexableJob(job) ? { robots: { index: false, follow: true } } : {}),
    };
}
export default async function InternshipDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const content = await getLocalizedJob(jobIdFromSlug(params.slug));
    const { job } = content;
    if (!job || job.type !== 'internship') {
        notFound();
    }
    // A job whose true category is another section (e.g. a remote internship, or a government internship)
    // must 308 to its canonical URL, like /jobs/[slug] does. Without this the same job answered 200 here
    // with a canonical pointing elsewhere: a duplicate page for Google to sort out.
    if (canonicalCategoryForJob(job) !== 'internships') {
        permanentRedirect(canonicalPathForJob(job));
    }
    const canonicalPath = localizedCanonicalPath(canonicalPathForJob(job), content);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const postingSchema = jobPostingSchema(job, canonicalUrl);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Internships', url: `${BASE_URL}/internships` },
        { name: job.title, url: canonicalUrl },
    ]);
    // See app/jobs/[slug]/page.tsx for why this is gated on content_faq
    // being non-empty (table_only-tier jobs deliberately get no FAQ).
    const faqItems = buildJobFaq(job);
    const faq = faqItems.length > 0 ? faqSchema(faqItems) : null;
    return (<main className="w-full">
      {postingSchema && (<script id="internship-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(postingSchema) }}/>)}
      <script id="internship-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      {faq && (<script id="internship-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(faq) }}/>)}
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="job_view" params={{ job_id: job.id, job_title: job.title, company: job.company }}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/internships" backLabel="Back to internships"/>
      </div>
    </main>);
}

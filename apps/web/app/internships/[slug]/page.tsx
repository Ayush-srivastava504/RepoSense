// Module: app/internships/[slug]/page.tsx
// Defines component(s)/export(s): NATIVE_AD_CONTAINER, InternshipDetailPage
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
    // A government internship's canonical page is government-jobs/[slug] (that
    // category outranks "internship"), so this route shouldn't describe it as
    // an internship page at all.
    if (!job || job.type !== 'internship' || canonicalCategoryForJob(job) !== 'internships') {
        return {};
    }
    const title = `${job.title} at ${job.company} — Internship`;
    const description = `Apply for the ${job.title} internship at ${job.company}${job.location ? ` in ${job.location}` : ''}. View eligibility, skills, stipend, and application details.`;
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
export default async function InternshipDetailPage({ params, }: {
    params: {
        slug: string;
    };
}) {
    const job = await getJobById(jobIdFromSlug(params.slug));
    if (!job || job.type !== 'internship') {
        notFound();
    }
    // A government-run internship must redirect to /government-jobs/[slug]
    // instead of rendering a second full page here — that category outranks
    // "internship" in canonicalCategoryForJob. This was the duplicate-content
    // gap: this route only ever checked type === 'internship' on its own, so a
    // government internship rendered a full 200 page at both URLs at once.
    if (canonicalCategoryForJob(job) !== 'internships') {
        permanentRedirect(canonicalPathForJob(job));
    }
    const canonicalPath = canonicalPathForJob(job);
    const canonicalUrl = `${BASE_URL}${canonicalPath}`;
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Internships', url: `${BASE_URL}/internships` },
        { name: job.title, url: canonicalUrl },
    ]);
    return (<main className="w-full">
      <script id="internship-posting-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema(job, canonicalUrl)) }}/>
      <script id="internship-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{
            __html: JSON.stringify(crumbs),
        }}/>
      <Breadcrumbs schema={crumbs}/>
      <div className="mx-auto w-full max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
        <JobDetail job={job} canonicalPath={canonicalPath} backHref="/internships" backLabel="Back to internships"/>
      </div>
    </main>);
}

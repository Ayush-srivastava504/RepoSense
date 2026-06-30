import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug } from '@/lib/slug';
import AdSlot from '@/app/components/AdSlot';

export const dynamic = 'force-dynamic';

const BASE_URL = 'https://intern-flow.in';

interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  url: string;
  source: string;
  posted_at: string;
  location?: string;
  type?: string;
  salary?: string;
  stipend?: string;
}

async function getJob(slug: string): Promise<Job | null> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return null;
  }

  const id = jobIdFromSlug(slug);

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/api/jobs/${id}`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      console.error('Job detail API returned', res.status, 'for id', id);
      return null;
    }

    return res.json();
  } catch (err) {
    console.error('Failed to fetch job:', err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const job = await getJob(params.slug);

  if (!job) return {};

  return {
    title: `${job.title} at ${job.company} — Internship`,
    description: job.description?.substring(0, 155),
    alternates: {
      canonical: `${BASE_URL}/jobs/${params.slug}`,
    },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const job = await getJob(params.slug);

  if (!job) notFound();

  const compensation = job.stipend || job.salary || null;

  const jobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.posted_at,
    employmentType: job.type === 'internship' ? 'INTERN' : 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company,
    },
    ...(job.location && {
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: job.location,
          addressCountry: 'IN',
        },
      },
    }),
    directApply: false,
  };

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jobPostingSchema),
        }}
      />

      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">
          {job.source || 'unknown'} ·{' '}
          {job.posted_at
            ? new Date(job.posted_at).toLocaleDateString()
            : 'Recent'}
        </p>

        {job.type && (
          <span className="chip chip-muted text-[0.65rem]">
            {job.type}
          </span>
        )}
      </div>

      <h1 className="display mt-2 text-3xl font-medium">
        {job.title}
      </h1>

      <p
        className="mt-1 text-sm"
        style={{ color: 'var(--ink-soft)' }}
      >
        {job.company}
        {job.location && ` · ${job.location}`}
      </p>

      {compensation && (
        <p
          className="mt-2 text-sm font-medium"
          style={{ color: 'var(--ink)' }}
        >
          {compensation}
        </p>
      )}

      <p
        className="mt-6 whitespace-pre-line text-sm leading-relaxed"
        style={{ color: 'var(--ink-soft)' }}
      >
        {job.description}
      </p>

      <AdSlot slot="1083783857" format="autorelaxed" className="mt-8" />

      <div className="mt-8 flex gap-3">
        {job.url ? (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
          >
            Apply now
          </a>
        ) : (
          <a
            href="/register"
            className="btn btn-primary"
          >
            Sign up to apply
          </a>
        )}

        <a
          href="/jobs"
          className="btn"
        >
          ← Back to listings
        </a>
      </div>
    </main>
  );
}
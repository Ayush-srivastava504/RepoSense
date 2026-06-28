import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { jobIdFromSlug } from '@/lib/slug';

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
}

async function getJob(slug: string): Promise<Job | null> {
  if (!process.env.API_BASE_URL) {
    console.error('API_BASE_URL is not set');
    return null;
  }

  const id = jobIdFromSlug(slug);

  try {
    const res = await fetch(`${process.env.API_BASE_URL}/public/jobs/${id}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
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
    description: job.description.substring(0, 155),
    alternates: { canonical: `${BASE_URL}/jobs/${params.slug}` },
  };
}

export default async function JobDetailPage({
  params,
}: {
  params: { slug: string };
}) {
  const job = await getJob(params.slug);
  if (!job) notFound();

  const jobPostingSchema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    datePosted: job.posted_at,
    employmentType: 'INTERN',
    hiringOrganization: { '@type': 'Organization', name: job.company },
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jobPostingSchema) }}
      />

      <p className="eyebrow">
        {job.source} · {new Date(job.posted_at).toLocaleDateString()}
      </p>
      <h1 className="display mt-2 text-3xl font-medium">{job.title}</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>
        {job.company} {job.location && `· ${job.location}`}
      </p>
      <p className="mt-6 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {job.description}
      </p>
      <a href="/register" className="btn btn-primary mt-8">
        Sign up to apply
      </a>
    </main>
  );
}
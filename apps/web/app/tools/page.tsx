import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

import { BASE_URL } from '@/lib/jobs';
import { TOOLS } from '@/app/tools/data';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Free AI Career Tools for Students',
  description:
    'Free AI tools built for engineering students: GitHub README generator, ATS resume checker, resume builder, LinkedIn optimizer, and cover letter generator.',
  alternates: { canonical: `${BASE_URL}/tools` },
};

export default function ToolsHubPage() {
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Tools', url: `${BASE_URL}/tools` },
  ]);

  return (
    <main className="w-full">
      <Script
        id="tools-hub-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <div className="mx-auto w-full max-w-5xl px-3 py-10 sm:px-4 sm:py-14">
        <p className="eyebrow eyebrow-accent">// ai tools</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          Free AI career tools for students
        </h1>
        <p className="mt-3 max-w-2xl" style={{ color: 'var(--ink-soft)' }}>
          Everything InternFlow builds to help engineering students go from GitHub commits to
          interview-ready applications — no enterprise pricing, no fluff.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {TOOLS.map((tool) => (
            <Link
              key={tool.slug}
              href={`/tools/${tool.slug}`}
              className="panel block p-5 transition hover:opacity-90"
            >
              <p className="eyebrow eyebrow-accent">// {tool.category.toLowerCase()}</p>
              <h2 className="display mt-2 text-lg font-medium">{tool.name}</h2>
              <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>{tool.tagline}</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}

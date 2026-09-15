// Module: app/batch/page.tsx
// Defines component(s)/export(s): BatchIndexPage
//
// PHASE_PLAN.md Phase 3 item 1 — mirrors app/jobs-in/page.tsx.

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { BATCHES } from '@/app/batch/data';
import {  breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export const metadata: Metadata = {
    title: 'Browse Jobs & Internships by Passout Batch',
    description: 'Find live jobs and internships open to your passout batch — 2025 through 2029 — with the companies hiring each year, updated daily.',
    alternates: { canonical: `${BASE_URL}/batch`, languages: languageAlternates('/batch') },
};

export default function BatchIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Batch', url: `${BASE_URL}/batch` },
    ]);

    return (<main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>

      <p className="eyebrow eyebrow-accent">// browse by batch</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">Jobs &amp; Internships by Batch</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Pick your passout year to see live jobs and internships that accept it, the companies
        hiring right now, and the resume and interview-prep tools to match.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BATCHES.map((b) => (<li key={b.year}>
            <Link href={`/batch/${b.year}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              {b.year} batch
              <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
            </Link>
          </li>))}
      </ul>
    </main>);
}

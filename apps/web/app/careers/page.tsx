// Module: app/careers/page.tsx
// Defines component(s)/export(s): CareersIndexPage
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { CAREERS } from '@/app/careers/data';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
    title: 'Career Paths for Engineering Students',
    description: 'What each engineering career path actually involves, the skills employers screen for, live jobs and internships, and the resume tools to apply — Software Engineer, AI/ML Engineer, DevOps Engineer, Data Engineer, and Data Analyst.',
    alternates: { canonical: `${BASE_URL}/careers` },
};

export default function CareersIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Careers', url: `${BASE_URL}/careers` },
    ]);

    return (<main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>

      <p className="eyebrow eyebrow-accent">// career paths</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">Career Paths for Engineering Students</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Pick a path to see what the role actually involves, the skills that show up in real job
        descriptions, live openings, and how to get your resume ready for it.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CAREERS.map((c) => (<li key={c.slug}>
            <Link href={`/careers/${c.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              {c.name}
              <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
            </Link>
          </li>))}
      </ul>
    </main>);
}

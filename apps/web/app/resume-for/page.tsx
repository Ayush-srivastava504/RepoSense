// Module: app/resume-for/page.tsx
// Defines component(s)/export(s): ResumeForIndexPage
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { RESUME_ROLES } from '@/app/resume-for/data';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
    title: 'Resume Guides by Role — Keywords, Bullets & ATS Tips',
    description: 'Role-specific resume guides with the ATS keywords, common mistakes, and bullet-point templates for Software Engineer, AI/ML Engineer, DevOps Engineer, Data Engineer, and Data Analyst roles.',
    alternates: { canonical: `${BASE_URL}/resume-for` },
};

export default function ResumeForIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Resume guides', url: `${BASE_URL}/resume-for` },
    ]);

    return (<main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>

      <p className="eyebrow eyebrow-accent">// resume guides</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">Resume Guides by Role</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Pick your target role to see the ATS keywords it's scored on, the mistakes that most often
        sink a resume for it, and bullet-point templates to adapt with your own numbers.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RESUME_ROLES.map((r) => (<li key={r.slug}>
            <Link href={`/resume-for/${r.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              {r.name}
              <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
            </Link>
          </li>))}
      </ul>
    </main>);
}

// Module: app/jobs-in/page.tsx
// Defines component(s)/export(s): CitiesIndexPage
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { CITIES } from '@/app/jobs-in/data';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
    title: 'Browse Jobs & Internships by City',
    description: 'Find live jobs and internships by city — Bangalore, Hyderabad, Chennai, Pune, Delhi NCR — with the companies hiring in each, updated daily.',
    alternates: { canonical: `${BASE_URL}/jobs-in` },
};

export default function CitiesIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Jobs by city', url: `${BASE_URL}/jobs-in` },
    ]);

    return (<main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>

      <p className="eyebrow eyebrow-accent">// browse by city</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">Jobs &amp; Internships by City</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Pick a city to see live jobs and internships based there, the companies hiring right now,
        and the resume and interview-prep tools to match.
      </p>

      <ul className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CITIES.map((c) => (<li key={c.slug}>
            <Link href={`/jobs-in/${c.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              {c.name}
              <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
            </Link>
          </li>))}
      </ul>
    </main>);
}

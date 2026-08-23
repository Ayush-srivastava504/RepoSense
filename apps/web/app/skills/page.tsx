// Module: app/skills/page.tsx
// Defines component(s)/export(s): SkillsIndexPage
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
import { BASE_URL } from '@/lib/jobs';
import { SKILLS, type SkillDefinition } from '@/app/skills/data';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
    title: 'Browse Jobs & Internships by Skill',
    description: 'Find live jobs and internships by skill — Python, React, SQL, AWS, and more — with the companies hiring and resume tools for each, updated daily.',
    alternates: { canonical: `${BASE_URL}/skills` },
};

function groupByCategory(skills: SkillDefinition[]) {
    const groups = new Map<string, SkillDefinition[]>();
    for (const s of skills) {
        const list = groups.get(s.category) ?? [];
        list.push(s);
        groups.set(s.category, list);
    }
    return groups;
}

export default function SkillsIndexPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Skills', url: `${BASE_URL}/skills` },
    ]);
    const grouped = groupByCategory(SKILLS);

    return (<main className="mx-auto w-full max-w-5xl px-3 py-8 sm:px-4 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>

      <p className="eyebrow eyebrow-accent">// browse by skill</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">Jobs &amp; Internships by Skill</h1>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Pick a skill to see live jobs and internships that need it, the companies hiring for it right
        now, and the resume and interview-prep tools to match.
      </p>

      {Array.from(grouped.entries()).map(([category, skills]) => (<section key={category} className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">{category}</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {skills.map((s) => (<li key={s.slug}>
                <Link href={`/skills/${s.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                  {s.name}
                  <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                </Link>
              </li>))}
          </ul>
        </section>))}
    </main>);
}

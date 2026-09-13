// Module: app/components/PopularSkills.tsx
// Defines component(s)/export(s): PopularSkills
//
// FresherFlow's top nav has a persistent "Skills" entry point next to
// Location/Role/Course/Source/Batch/Company. RepoSense already has full
// /skills/[slug] hub pages (app/skills/data.ts) with their own SEO copy
// and job counts — this is a lightweight strip that surfaces a handful of
// them directly on the jobs/internships list pages, the same way
// location/role filters sit right above the results, instead of skills
// only being reachable by already knowing the /skills URL exists.

import Link from 'next/link';
import { SKILLS } from '@/app/skills/data';

// A representative cross-section of the taxonomy — one or two entries
// per category — rather than all 24, so the strip stays a single line on
// mobile. Curated by slug so this stays stable if data.ts is reordered.
const FEATURED_SKILL_SLUGS = [
    'python', 'javascript', 'react', 'java', 'sql', 'aws', 'machine-learning', 'excel',
];

export default function PopularSkills({ className = '' }: { className?: string }) {
    const featured = FEATURED_SKILL_SLUGS.map((slug) => SKILLS.find((s) => s.slug === slug)).filter((s): s is NonNullable<typeof s> => Boolean(s));
    if (featured.length === 0)
        return null;
    return (<div className={`flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:pb-0 ${className}`}>
      <span className="eyebrow text-[0.65rem] sm:text-xs mr-1 flex-none" style={{ color: 'var(--ink-soft)' }}>
        skills
      </span>
      {featured.map((s) => (<Link key={s.slug} href={`/skills/${s.slug}`} className="chip chip-muted text-[0.7rem] sm:text-xs touch-manipulation flex-none">
          {s.name}
        </Link>))}
      <Link href="/skills" className="chip chip-muted text-[0.7rem] sm:text-xs touch-manipulation flex-none">
        All skills →
      </Link>
    </div>);
}

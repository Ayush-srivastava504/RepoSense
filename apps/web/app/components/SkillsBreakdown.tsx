// Module: app/components/SkillsBreakdown.tsx
// Defines component(s)/export(s): SkillsBreakdown
//
// Two views of the same underlying data, both real fields already on the
// job (nothing invented):
//   - a size-varied skill cloud for job.required_skills (structured
//     extraction — crawler/src/structured_enrichment.py)
//   - a Required vs Also Mentioned comparison: required_skills vs
//     enriched_keywords (the broader AI-overview keyword set — crawler/
//     src/content_enrichment.py) with the overlap removed, so "Also
//     Mentioned" only shows keywords that didn't already make the
//     required-skills cut. There's no separate "preferred skills" field
//     in the data model, so this is the honest comparison the data
//     actually supports rather than a fabricated preferred-skills list.
//
// Renders nothing if required_skills is empty — StructuredDetails.tsx
// already renders a plain required_skills chip list elsewhere on the
// page, so this component is skipped entirely when there's nothing to
// compare against (no point duplicating an empty state).

import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { matchSkillSlug } from '@/lib/skillMatch';

function SkillChip({ skill, size }: { skill: string; size: 'sm' | 'md' | 'lg' }) {
    const slug = matchSkillSlug(skill);
    const sizeClass = size === 'lg' ? 'text-sm px-3 py-1.5' : size === 'md' ? 'text-xs px-2.5 py-1' : 'text-[0.65rem] px-2 py-0.5';
    const className = `chip chip-muted ${sizeClass}`;
    return slug ? (<Link href={`/skills/${slug}`} className={`${className} hover:underline`}>
      {skill}
    </Link>) : (<span className={className}>{skill}</span>);
}

export default function SkillsBreakdown({ job }: { job: Job }) {
    const required = job.required_skills || [];
    if (required.length === 0) {
        return null;
    }
    const requiredLower = new Set(required.map((s) => s.toLowerCase()));
    const alsoMentioned = (job.enriched_keywords || []).filter((k) => !requiredLower.has(k.toLowerCase()));
    return (<section className="mt-6">
      <h2 className="display text-lg font-medium">Skills for this role</h2>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {required.map((skill, i) => (<SkillChip key={skill} skill={skill} size={i < 3 ? 'lg' : i < 7 ? 'md' : 'sm'}/>))}
      </div>

      {alsoMentioned.length > 0 && (<div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
              Required skills
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {required.map((skill) => (<SkillChip key={skill} skill={skill} size="sm"/>))}
            </div>
          </div>
          <div className="panel p-4">
            <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
              Also mentioned in the listing
            </h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {alsoMentioned.map((skill) => (<SkillChip key={skill} skill={skill} size="sm"/>))}
            </div>
          </div>
        </div>)}
    </section>);
}

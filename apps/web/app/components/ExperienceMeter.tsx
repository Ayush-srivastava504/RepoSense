// Module: app/components/ExperienceMeter.tsx
// Defines component(s)/export(s): ExperienceMeter
//
// Visualizes job.experience_min/experience_max (structured extraction —
// crawler/src/structured_enrichment.py) as a filled meter against a fixed
// 0-10 year scale, capped at 10+ for senior roles. StructuredDetails.tsx
// already prints this as plain text ("0-2 yrs experience") elsewhere on
// the page; this is the visual-meter form of the same real field, not a
// second, different number.

import type { Job } from '@/lib/jobs';

const SCALE_MAX = 10;

export default function ExperienceMeter({ job }: { job: Job }) {
    const hasExperience = typeof job.experience_max === 'number' && job.experience_max > 0;
    if (!hasExperience) {
        return null;
    }
    const min = job.experience_min ?? 0;
    const max = job.experience_max as number;
    const fillPct = Math.min(100, Math.round((max / SCALE_MAX) * 100));
    const startPct = Math.min(100, Math.round((min / SCALE_MAX) * 100));
    const label = min === 0 ? `Fresher-friendly, up to ${max} yrs` : `${min}-${max} years experience`;
    return (<section className="panel mt-4 p-4">
      <div className="flex items-center justify-between text-xs">
        <h3 className="font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
          Experience required
        </h3>
        <span style={{ color: 'var(--ink)' }}>{label}</span>
      </div>
      <div className="relative mt-2.5 h-2 w-full overflow-hidden rounded-full" style={{ background: 'var(--bg-soft)' }}>
        <div className="absolute top-0 h-full rounded-full" style={{
            left: `${startPct}%`,
            width: `${Math.max(4, fillPct - startPct)}%`,
            background: 'var(--indigo)',
        }}/>
      </div>
      <div className="mt-1 flex justify-between text-[0.65rem]" style={{ color: 'var(--ink-soft)' }}>
        <span>0 yrs</span>
        <span>{SCALE_MAX}+ yrs</span>
      </div>
    </section>);
}

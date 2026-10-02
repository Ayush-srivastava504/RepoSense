// Module: app/components/JobSections.tsx
// Responsibilities, preparation tips, common mistakes and resume keywords for one job. Text comes from
// jobs.enriched_sections (job_sections_service.py: grounded in this listing, numbers and keywords validated).
// Each block renders only if it has content; a job not yet processed shows nothing here.
import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { matchSkillSlug } from '@/lib/skillMatch';

function Block({ id, title, items }: { id: string; title: string; items: string[] }) {
    if (items.length === 0)
        return null;
    return (<section id={id} className="mt-8">
      <h2 className="display text-lg font-medium">{title}</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>
        {items.map((t) => (<li key={t}>{t}</li>))}
      </ul>
    </section>);
}

export function JobResponsibilities({ job }: { job: Job }) {
    return <Block id="responsibilities" title={`${job.title}: role and responsibilities`} items={job.enriched_sections?.responsibilities ?? []}/>;
}

export function JobPreparation({ job }: { job: Job }) {
    const s = job.enriched_sections;
    const keywords = s?.ats_keywords ?? [];
    return (<>
      <Block id="preparation" title={`How to prepare for the ${job.title} role`} items={s?.prep_tips ?? []}/>
      <Block id="common-mistakes" title="Common mistakes to avoid" items={s?.common_mistakes ?? []}/>
      {keywords.length > 0 && (<section id="resume-keywords" className="mt-8">
          <h2 className="display text-lg font-medium">Resume keywords for this listing</h2>
          <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
            Terms the listing itself uses. Include the ones you can back with a project or experience.
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {keywords.map((kw) => {
            const slug = matchSkillSlug(kw);
            return slug ? (<Link key={kw} href={`/skills/${slug}`} className="chip chip-muted text-xs hover:underline">{kw}</Link>) : (<span key={kw} className="chip chip-muted text-xs">{kw}</span>);
        })}
          </div>
          <p className="mt-3 text-sm">
            <Link href="/tools/ats-resume-checker" className="underline">Check your resume against these keywords</Link>
          </p>
        </section>)}
    </>);
}

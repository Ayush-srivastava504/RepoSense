// Module: app/components/JobFAQ.tsx
// Questions with the answers always visible (no tap-to-expand): readers see the answer immediately and the
// visible text is exactly what the FAQPage JSON-LD in the page carries. Built by lib/jobFaq.ts.
import type { Job } from '@/lib/jobs';
import { buildJobFaq } from '@/lib/jobFaq';

export default function JobFAQ({ job }: { job: Job }) {
    const items = buildJobFaq(job);
    if (items.length === 0)
        return null;
    return (<section className="mt-8" id="faq">
      <h2 className="display text-lg font-medium">
        {job.title} at {job.company}: frequently asked questions
      </h2>
      <dl className="mt-3 divide-y" style={{ borderColor: 'var(--line)' }}>
        {items.map((f) => (<div key={f.question} className="py-4">
            <dt className="text-sm font-medium sm:text-base">{f.question}</dt>
            <dd className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{f.answer}</dd>
          </div>))}
      </dl>
    </section>);
}

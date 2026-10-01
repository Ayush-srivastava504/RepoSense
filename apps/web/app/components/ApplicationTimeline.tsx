// Module: app/components/ApplicationTimeline.tsx
// Defines component(s)/export(s): ApplicationTimeline
//
// A typical-process explainer, not a claim about this specific employer's
// process (the crawl data has no field for an individual company's actual
// hiring steps, so presenting one would be fabricated). Labelled "Typical
// process" throughout and varies only by job.type/is_government, which
// are real fields — a government posting's process genuinely differs
// (written exam / merit list) from a standard tech-hiring funnel, and an
// internship funnel is genuinely shorter than a full-time one.

import type { Job } from '@/lib/jobs';

function stepsFor(job: Job): {
    title: string;
    blurb: string;
}[] {
    if (job.is_government) {
        return [
            { title: 'Application', blurb: 'Submit the online form before the notified deadline.' },
            { title: 'Admit card', blurb: 'Download your admit card / hall ticket closer to the exam date.' },
            { title: 'Written exam', blurb: 'Most government roles gate on a written or objective-type exam.' },
            { title: 'Merit list / interview', blurb: 'Shortlisting is usually by merit list, sometimes followed by an interview.' },
            { title: 'Document verification', blurb: 'Final step before appointment — carry original certificates.' },
        ];
    }
    if (job.type === 'internship') {
        return [
            { title: 'Application', blurb: 'Apply with your resume and, where asked, a short cover note.' },
            { title: 'Screening', blurb: 'Recruiter or hiring manager reviews fit against the role.' },
            { title: 'Interview', blurb: 'Usually one round — a mix of technical and fit questions.' },
            { title: 'Offer', blurb: 'Offer letter with stipend, duration, and start date.' },
        ];
    }
    return [
        { title: 'Application', blurb: 'Submit your resume through the apply link.' },
        { title: 'Screening', blurb: 'Recruiter reviews your background against the role.' },
        { title: 'Assessment', blurb: 'A technical test, assignment, or coding round, depending on the role.' },
        { title: 'Interview(s)', blurb: 'One or more rounds with the hiring team.' },
        { title: 'Offer', blurb: 'Offer letter with compensation and start date.' },
    ];
}

export default function ApplicationTimeline({ job }: { job: Job }) {
    const steps = stepsFor(job);
    return (<section className="mt-6">
      <h2 className="display text-lg font-medium">Typical process for this type of role</h2>
      <p className="mt-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
        A general guide — the exact steps for this specific listing may vary; check the original posting for details.
      </p>

      <ol className="mt-3 flex flex-col gap-0 sm:flex-row sm:gap-0">
        {steps.map((step, i) => (<li key={step.title} className="relative flex flex-1 flex-col gap-1 py-2 pl-6 sm:border-t-2 sm:border-l-0 sm:pl-0 sm:pt-4 sm:pl-0" style={{
                    borderLeft: '2px solid var(--line)',
                    borderColor: 'var(--line)',
                }}>
            <span className="absolute -left-[9px] top-2 flex h-4 w-4 items-center justify-center rounded-full text-[0.6rem] font-semibold sm:-left-0 sm:-top-[9px]" style={{
                    background: 'var(--indigo)',
                    color: 'white',
                }}>
              {i + 1}
            </span>
            <span className="text-sm font-medium pl-2 sm:pl-0" style={{ color: 'var(--ink)' }}>
              {step.title}
            </span>
            <span className="text-xs pl-2 sm:pl-0" style={{ color: 'var(--ink-soft)' }}>
              {step.blurb}
            </span>
          </li>))}
      </ol>
    </section>);
}

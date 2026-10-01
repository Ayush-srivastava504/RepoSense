// Module: app/components/ApplyChecklist.tsx
// Defines component(s)/export(s): ApplyChecklist
//
// Generic "before you apply" checklist — items are standard prep advice,
// not claims about this employer's actual requirements. Varies slightly
// by job.type/is_government (real fields) since a government posting and
// a tech internship genuinely call for different documents.

'use client';

import { useState } from 'react';
import type { Job } from '@/lib/jobs';

function itemsFor(job: Job): string[] {
    const base = ['Updated resume saved as a PDF', 'Read the full job description and eligibility criteria'];
    if (job.is_government) {
        return [
            ...base,
            'Scanned copies of certificates and marksheets',
            'Valid photo ID for document verification',
            'Category/reservation certificate, if applicable',
            'Passport-size photograph in the specified format',
        ];
    }
    if (job.type === 'internship') {
        return [...base, 'A portfolio or GitHub link showcasing relevant projects', 'A short note on why you want this internship, ready to paste in'];
    }
    return [...base, 'Portfolio, GitHub, or work samples relevant to the role', 'Notice period and expected compensation, in case it comes up'];
}

export default function ApplyChecklist({ job }: { job: Job }) {
    const items = itemsFor(job);
    const [checked, setChecked] = useState<boolean[]>(() => items.map(() => false));
    const doneCount = checked.filter(Boolean).length;
    return (<section className="panel mt-6 p-4">
      <div className="flex items-center justify-between">
        <h2 className="display text-sm font-medium">Before you apply</h2>
        <span className="text-xs" style={{ color: 'var(--ink-soft)' }}>
          {doneCount}/{items.length}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {items.map((item, i) => (<li key={item}>
            <label className="flex cursor-pointer items-start gap-2.5 text-sm" style={{ color: checked[i] ? 'var(--ink-soft)' : 'var(--ink)' }}>
              <input type="checkbox" checked={checked[i]} onChange={() => setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)))} className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ accentColor: 'var(--indigo)' }}/>
              <span style={{ textDecoration: checked[i] ? 'line-through' : 'none' }}>
                {item}
              </span>
            </label>
          </li>))}
      </ul>
    </section>);
}

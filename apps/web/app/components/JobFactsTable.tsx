// Module: app/components/JobFactsTable.tsx
// Defines component(s)/export(s): JobFactsTable
//
// Renders job.content_table — crawler/src/processors/content_layer.py's
// build_table(), a deterministic label/value list (Role, Company,
// Location, Type, Compensation, Posted, Deadline) computed at crawl time
// for every kept job regardless of content_tier (unlike content_faq,
// table_only-tier jobs still get this). No LLM involved — straight field
// extraction, so there's nothing here that can be stale relative to the
// job row itself except by a missed re-crawl.

import type { Job } from '@/lib/jobs';

export default function JobFactsTable({ job }: { job: Job }) {
    const rows = (job.content_table || []).filter((r) => r.value && r.value.trim().length > 0);
    if (rows.length === 0) {
        return null;
    }
    return (<section className="panel mt-5 overflow-hidden">
      <table className="w-full table-fixed text-sm">
        <tbody>
          {rows.map((row, i) => (<tr key={row.label} style={{
                    borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                }}>
              <th scope="row" className="w-1/3 px-4 py-2.5 text-left font-medium [overflow-wrap:anywhere]" style={{ color: 'var(--ink-soft)' }}>
                {row.label}
              </th>
              <td className="px-4 py-2.5 [overflow-wrap:anywhere]" style={{ color: 'var(--ink)' }}>
                {row.value}
              </td>
            </tr>))}
        </tbody>
      </table>
    </section>);
}

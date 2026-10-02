// Server component: horizontal CSS bar chart with a visible sample size + date, so every
// figure on the page states what it is based on. No chart library -- plain markup that also
// reads fine to crawlers (labels and values are real text).

interface Props {
    title: string;
    description?: string;
    labels: string[];
    values: number[];
    unit?: string;
    sampleSize: number;
    computedAt: string;
}

export default function StatBarChart({ title, description, labels, values, unit = '%', sampleSize, computedAt }: Props) {
    const max = Math.max(...values, 1);
    const updated = new Date(computedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
    return (
        <figure className="rounded-xl border p-5" style={{ borderColor: 'var(--line)' }}>
            <figcaption>
                <h3 className="text-base font-medium">{title}</h3>
                {description && <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{description}</p>}
            </figcaption>
            <ul className="mt-4 space-y-2" aria-label={title}>
                {labels.map((label, i) => (
                    <li key={label} className="flex items-center gap-3 text-sm">
                        <span className="w-28 shrink-0 sm:w-36" style={{ color: 'var(--ink-soft)' }}>{label}</span>
                        <span className="h-3 flex-1 rounded-full" style={{ background: 'var(--line)' }} aria-hidden="true">
                            <span className="block h-3 rounded-full" style={{ width: `${(values[i] / max) * 100}%`, background: 'var(--indigo)' }} />
                        </span>
                        <span className="w-14 shrink-0 text-right tabular-nums">{values[i]}{unit}</span>
                    </li>
                ))}
            </ul>
            <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
                Based on {sampleSize.toLocaleString('en-US')} live InternFlow listings · updated {updated}
            </p>
        </figure>
    );
}

// Module: lib/chartStats.ts
// Reads the nightly aggregates the API builds into chart_stats (services/chart_aggregator.py).
// Returns null on any failure or when the API has no chart for the key (404 = not enough
// listings to chart honestly) so callers simply render no chart rather than a fake one.

const API_BASE_URL = process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';

export interface ChartStats {
    chart_key: string;
    kind: 'segment' | 'topic';
    sample_size: number;
    computed_at: string;
    stats: {
        basis?: string;
        skills_pct: Record<string, number>;
        experience_pct: Record<string, number>;
        experience_known: number;
        work_mode_pct: Record<string, number>;
        work_mode_known: number;
        top_locations: { name: string; pct: number }[];
    };
}

export async function getChartStats(key: string): Promise<ChartStats | null> {
    try {
        const res = await fetch(`${API_BASE_URL}/api/charts/${encodeURIComponent(key).replace(/%3A/gi, ':')}`, {
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) return null;
        return (await res.json()) as ChartStats;
    } catch {
        return null;
    }
}

/** Values for a chart's x-axis labels from the stats; null if any label has no value (never partial charts). */
export function seriesFor(stats: ChartStats, metric: 'skills' | 'experience', xAxis: string[]): number[] | null {
    const table = metric === 'skills' ? stats.stats.skills_pct : stats.stats.experience_pct;
    const out: number[] = [];
    for (const label of xAxis) {
        const v = table[label];
        if (typeof v !== 'number') return null;
        out.push(v);
    }
    return out;
}

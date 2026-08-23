// Module: app/components/JobsSearchTracker.tsx
// Defines component(s)/export(s): JobsSearchTracker
//
//

'use client';
import { useEffect } from 'react';
import { trackJobSearch, trackFilterUsage } from '@/lib/analytics';
export default function JobsSearchTracker({ search, resultCount, filters, }: {
    search: string;
    resultCount: number;
    filters?: Record<string, string | undefined>;
}) {
    useEffect(() => {
        if (search) {
            trackJobSearch({ query: search, result_count: resultCount });
        }
        if (filters) {
            Object.entries(filters).forEach(([filterType, filterValue]) => {
                if (filterValue) {
                    trackFilterUsage({ filter_type: filterType, filter_value: filterValue });
                }
            });
        }
    }, [search, resultCount, JSON.stringify(filters)]);
    return null;
}

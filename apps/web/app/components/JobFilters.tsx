// Module: app/components/JobFilters.tsx
// Defines component(s)/export(s): LOCATION_OPTIONS, GROUP_OPTIONS, JobFilters, RoleFilter
// Defines function(s): parseLocationFilter, parseGroupFilter
// Defines type(s): LocationFilter, GroupFilter

import Link from 'next/link';
export type LocationFilter = 'all' | 'india' | 'remote' | 'japan';
export type GroupFilter = 'all' | 'software' | 'sales' | 'finance' | 'other';
// Backed by the `work_mode` column structured_enrichment.py extracts
// (ONSITE/REMOTE/HYBRID) — distinct from LocationFilter's 'remote', which
// is the coarser is_remote flag some sources set directly. A job can be
// in India *and* onsite/hybrid, so this is a separate, composable filter
// rather than folded into LOCATION_OPTIONS.
export type WorkModeFilter = 'all' | 'ONSITE' | 'REMOTE' | 'HYBRID';
const LOCATION_OPTIONS: {
    value: LocationFilter;
    label: string;
}[] = [
    { value: 'all', label: 'All locations' },
    { value: 'india', label: 'India' },
    { value: 'remote', label: 'Remote' },
    { value: 'japan', label: 'Japan' },
];
const GROUP_OPTIONS: {
    value: GroupFilter;
    label: string;
}[] = [
    { value: 'all', label: 'All roles' },
    { value: 'software', label: 'Software Engineer' },
    { value: 'sales', label: 'Sales' },
    { value: 'finance', label: 'Finance' },
    { value: 'other', label: 'Other' },
];
const WORK_MODE_OPTIONS: {
    value: WorkModeFilter;
    label: string;
}[] = [
    { value: 'all', label: 'Any work mode' },
    { value: 'ONSITE', label: '🏢 Onsite' },
    { value: 'REMOTE', label: '🏠 Remote' },
    { value: 'HYBRID', label: '🔀 Hybrid' },
];
export default function JobFilters({ basePath, search, location, group, mode = 'all', }: {
    basePath: string;
    search: string;
    location: LocationFilter;
    group: GroupFilter;
    mode?: WorkModeFilter;
}) {
    const buildHref = (nextLocation: LocationFilter, nextGroup: GroupFilter, nextMode: WorkModeFilter = mode) => {
        const params = new URLSearchParams();
        if (search)
            params.set('search', search);
        if (nextLocation !== 'all')
            params.set('loc', nextLocation);
        if (nextGroup !== 'all')
            params.set('role', nextGroup);
        if (nextMode !== 'all')
            params.set('mode', nextMode);
        const qs = params.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    };
    return (<div className="mt-4 flex flex-col gap-3">
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:pb-0">
        <span className="eyebrow text-[0.65rem] sm:text-xs mr-1 flex-none" style={{ color: 'var(--ink-soft)' }}>
          location
        </span>
        {LOCATION_OPTIONS.map((opt) => (<Link key={opt.value} href={buildHref(opt.value, group)} className={`chip text-[0.7rem] sm:text-xs touch-manipulation flex-none ${location === opt.value ? 'chip-indigo' : 'chip-muted'}`}>
            {opt.label}
          </Link>))}
      </div>

      <RoleFilter basePath={basePath} search={search} group={group} location={location} mode={mode}/>

      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:pb-0">
        <span className="eyebrow text-[0.65rem] sm:text-xs mr-1 flex-none" style={{ color: 'var(--ink-soft)' }}>
          work mode
        </span>
        {WORK_MODE_OPTIONS.map((opt) => (<Link key={opt.value} href={buildHref(location, group, opt.value)} className={`chip text-[0.7rem] sm:text-xs touch-manipulation flex-none ${mode === opt.value ? 'chip-indigo' : 'chip-muted'}`}>
            {opt.label}
          </Link>))}
      </div>
    </div>);
}
export function RoleFilter({ basePath, search, group, location, mode, }: {
    basePath: string;
    search: string;
    group: GroupFilter;
    location?: LocationFilter;
    mode?: WorkModeFilter;
}) {
    const buildHref = (nextGroup: GroupFilter) => {
        const params = new URLSearchParams();
        if (search)
            params.set('search', search);
        if (location && location !== 'all')
            params.set('loc', location);
        if (mode && mode !== 'all')
            params.set('mode', mode);
        if (nextGroup !== 'all')
            params.set('role', nextGroup);
        const qs = params.toString();
        return qs ? `${basePath}?${qs}` : basePath;
    };
    return (<div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:pb-0">
      <span className="eyebrow text-[0.65rem] sm:text-xs mr-1 flex-none" style={{ color: 'var(--ink-soft)' }}>
        role
      </span>
      {GROUP_OPTIONS.map((opt) => (<Link key={opt.value} href={buildHref(opt.value)} className={`chip text-[0.7rem] sm:text-xs touch-manipulation flex-none ${group === opt.value ? 'chip-indigo' : 'chip-muted'}`}>
          {opt.label}
        </Link>))}
    </div>);
}
export function parseLocationFilter(value: string | undefined): LocationFilter {
    return value === 'india' || value === 'remote' || value === 'japan' ? value : 'all';
}
export function parseGroupFilter(value: string | undefined): GroupFilter {
    return value === 'software' || value === 'sales' || value === 'finance' || value === 'other'
        ? value
        : 'all';
}
export function parseWorkModeFilter(value: string | undefined): WorkModeFilter {
    return value === 'ONSITE' || value === 'REMOTE' || value === 'HYBRID' ? value : 'all';
}

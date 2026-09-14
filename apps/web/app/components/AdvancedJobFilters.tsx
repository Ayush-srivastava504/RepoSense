'use client';
// Module: app/components/AdvancedJobFilters.tsx
// Defines component(s)/export(s): AdvancedJobFilters
//
// PHASE 1 — the FresherFlow-parity filter bar: a row of dropdown-popover
// filters (Location, Role, Skills, Course, Source, Batch, Company), each
// with a search box where useful and live "(N)" counts, matching
// FresherFlow's /internships filter UX. Renders below the existing quick
// chip filters (JobFilters.tsx) rather than replacing them, so the
// single-tap common cases (All / India / Remote) stay one click away.
//
// Location / Role / Work Mode changes navigate (they determine the
// server-side fetch in jobs/page.tsx). Skills / Course / Source / Batch /
// Company changes update the URL too, but are applied client-side over
// the already-fetched job list via lib/filterJobs.ts — see that file's
// header comment for the Phase 1 vs Phase 2 scope note.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FacetOption, FacetSnapshot } from '@/lib/facets';
import type { LocationFilter, GroupFilter, WorkModeFilter } from '@/app/components/JobFilters';
import { encodeMultiParam } from '@/lib/filterJobs';

const LOCATION_OPTIONS: { value: LocationFilter; label: string }[] = [
    { value: 'all', label: 'All Locations' },
    { value: 'india', label: 'India' },
    { value: 'remote', label: 'Remote' },
    { value: 'japan', label: 'Japan' },
];

const WORK_MODE_OPTIONS: { value: WorkModeFilter; label: string }[] = [
    { value: 'all', label: 'Any' },
    { value: 'REMOTE', label: 'Remote' },
    { value: 'HYBRID', label: 'Hybrid' },
    { value: 'ONSITE', label: 'On-site' },
];

const ROLE_OPTIONS: { value: GroupFilter; label: string }[] = [
    { value: 'all', label: 'All Roles' },
    { value: 'software', label: 'Software Engineer' },
    { value: 'sales', label: 'Sales' },
    { value: 'finance', label: 'Finance' },
    { value: 'other', label: 'Other' },
];

interface Props {
    basePath: string;
    search: string;
    location: LocationFilter;
    group: GroupFilter;
    mode: WorkModeFilter;
    skills: string[];
    courses: string[];
    sources: string[];
    batches: string[];
    companies: string[];
    facets: FacetSnapshot;
    resultCount: number;
}

type DropdownKey = 'location' | 'role' | 'skills' | 'course' | 'source' | 'batch' | 'company' | null;

export default function AdvancedJobFilters({
    basePath,
    search,
    location,
    group,
    mode,
    skills,
    courses,
    sources,
    batches,
    companies,
    facets,
    resultCount,
}: Props) {
    const router = useRouter();
    const [open, setOpen] = useState<DropdownKey>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setOpen(null);
            }
        }
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setOpen(null);
        }
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, []);

    const navigate = (overrides: {
        location?: LocationFilter;
        group?: GroupFilter;
        mode?: WorkModeFilter;
        skills?: string[];
        courses?: string[];
        sources?: string[];
        batches?: string[];
        companies?: string[];
    }) => {
        const next = {
            location: overrides.location ?? location,
            group: overrides.group ?? group,
            mode: overrides.mode ?? mode,
            skills: overrides.skills ?? skills,
            courses: overrides.courses ?? courses,
            sources: overrides.sources ?? sources,
            batches: overrides.batches ?? batches,
            companies: overrides.companies ?? companies,
        };
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (next.location !== 'all') params.set('loc', next.location);
        if (next.group !== 'all') params.set('role', next.group);
        if (next.mode !== 'all') params.set('mode', next.mode);
        const skillsParam = encodeMultiParam(next.skills);
        if (skillsParam) params.set('skills', skillsParam);
        const courseParam = encodeMultiParam(next.courses);
        if (courseParam) params.set('course', courseParam);
        const sourceParam = encodeMultiParam(next.sources);
        if (sourceParam) params.set('source', sourceParam);
        const batchParam = encodeMultiParam(next.batches);
        if (batchParam) params.set('batch', batchParam);
        const companyParam = encodeMultiParam(next.companies);
        if (companyParam) params.set('company', companyParam);
        const qs = params.toString();
        router.push(qs ? `${basePath}?${qs}` : basePath);
    };

    const toggleValue = (list: string[], value: string): string[] =>
        list.includes(value) ? list.filter((v) => v !== value) : [...list, value];

    const activeCount =
        (location !== 'all' ? 1 : 0) +
        (group !== 'all' ? 1 : 0) +
        (mode !== 'all' ? 1 : 0) +
        skills.length +
        courses.length +
        sources.length +
        batches.length +
        companies.length;

    return (
        <div ref={containerRef} className="mt-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-1.5">
                    <DropdownTrigger
                        label="Location"
                        activeLabel={location !== 'all' || mode !== 'all' ? locationSummary(location, mode) : undefined}
                        isOpen={open === 'location'}
                        onToggle={() => setOpen(open === 'location' ? null : 'location')}
                    >
                        <div className="w-64 max-w-[80vw]">
                            <p className="px-3 pt-3 text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                                Work Mode
                            </p>
                            <div className="flex flex-col gap-0.5 px-1.5 py-1.5">
                                {WORK_MODE_OPTIONS.map((opt) => (
                                    <CheckRow
                                        key={opt.value}
                                        label={opt.label}
                                        checked={mode === opt.value}
                                        onClick={() => navigate({ mode: opt.value })}
                                    />
                                ))}
                            </div>
                            <div className="hr-line mx-1.5" />
                            <p className="px-3 pt-2 text-[0.65rem] font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                                Locations
                            </p>
                            <div className="flex flex-col gap-0.5 px-1.5 pb-2 pt-1">
                                {LOCATION_OPTIONS.map((opt) => (
                                    <CheckRow
                                        key={opt.value}
                                        label={opt.label}
                                        checked={location === opt.value}
                                        onClick={() => navigate({ location: opt.value })}
                                    />
                                ))}
                            </div>
                        </div>
                    </DropdownTrigger>

                    <DropdownTrigger
                        label="Role"
                        activeLabel={group !== 'all' ? ROLE_OPTIONS.find((o) => o.value === group)?.label : undefined}
                        isOpen={open === 'role'}
                        onToggle={() => setOpen(open === 'role' ? null : 'role')}
                    >
                        <div className="w-56 max-w-[80vw] flex flex-col gap-0.5 p-1.5">
                            {ROLE_OPTIONS.map((opt) => (
                                <CheckRow
                                    key={opt.value}
                                    label={opt.label}
                                    checked={group === opt.value}
                                    onClick={() => navigate({ group: opt.value })}
                                />
                            ))}
                        </div>
                    </DropdownTrigger>

                    <MultiSelectDropdown
                        label="Skills"
                        isOpen={open === 'skills'}
                        onToggle={() => setOpen(open === 'skills' ? null : 'skills')}
                        options={facets.skills}
                        selected={skills}
                        searchable
                        searchPlaceholder="Search skills..."
                        onToggleOption={(value) => navigate({ skills: toggleValue(skills, value) })}
                        onClear={() => navigate({ skills: [] })}
                    />

                    <MultiSelectDropdown
                        label="Course"
                        isOpen={open === 'course'}
                        onToggle={() => setOpen(open === 'course' ? null : 'course')}
                        options={facets.courses}
                        selected={courses}
                        onToggleOption={(value) => navigate({ courses: toggleValue(courses, value) })}
                        onClear={() => navigate({ courses: [] })}
                    />

                    <MultiSelectDropdown
                        label="Source"
                        isOpen={open === 'source'}
                        onToggle={() => setOpen(open === 'source' ? null : 'source')}
                        options={facets.sources}
                        selected={sources}
                        searchable
                        searchPlaceholder="Search sources..."
                        onToggleOption={(value) => navigate({ sources: toggleValue(sources, value) })}
                        onClear={() => navigate({ sources: [] })}
                    />

                    <MultiSelectDropdown
                        label="Batch"
                        isOpen={open === 'batch'}
                        onToggle={() => setOpen(open === 'batch' ? null : 'batch')}
                        options={facets.batches}
                        selected={batches}
                        onToggleOption={(value) => navigate({ batches: toggleValue(batches, value) })}
                        onClear={() => navigate({ batches: [] })}
                    />

                    <MultiSelectDropdown
                        label="Company"
                        isOpen={open === 'company'}
                        onToggle={() => setOpen(open === 'company' ? null : 'company')}
                        options={facets.companies}
                        selected={companies}
                        searchable
                        searchPlaceholder="Search companies..."
                        onToggleOption={(value) => navigate({ companies: toggleValue(companies, value) })}
                        onClear={() => navigate({ companies: [] })}
                    />

                    {activeCount > 0 && (
                        <button
                            type="button"
                            onClick={() => navigate({ location: 'all', group: 'all', mode: 'all', skills: [], courses: [], sources: [], batches: [], companies: [] })}
                            className="chip chip-rust text-[0.7rem] touch-manipulation"
                        >
                            Clear all ({activeCount})
                        </button>
                    )}
                </div>

                <p className="hidden shrink-0 text-xs sm:block" style={{ color: 'var(--ink-soft)' }}>
                    {resultCount} found
                </p>
            </div>
        </div>
    );
}

function locationSummary(location: LocationFilter, mode: WorkModeFilter): string {
    const loc = LOCATION_OPTIONS.find((o) => o.value === location)?.label;
    const wm = WORK_MODE_OPTIONS.find((o) => o.value === mode)?.label;
    if (loc && loc !== 'All Locations' && wm && wm !== 'Any') return `${loc} · ${wm}`;
    return loc && loc !== 'All Locations' ? loc : wm ?? '';
}

function DropdownTrigger({
    label,
    activeLabel,
    isOpen,
    onToggle,
    children,
}: {
    label: string;
    activeLabel?: string;
    isOpen: boolean;
    onToggle: () => void;
    children: React.ReactNode;
}) {
    return (
        <div className="relative">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={isOpen}
                className={`chip text-[0.7rem] sm:text-xs touch-manipulation flex items-center gap-1 ${activeLabel ? 'chip-indigo' : 'chip-muted'}`}
            >
                {activeLabel ? `${label}: ${activeLabel}` : label}
                <CaretIcon />
            </button>
            {isOpen && (
                <div
                    className="panel absolute left-0 top-[calc(100%+6px)] z-30 max-h-[70vh] overflow-y-auto"
                    style={{ background: 'var(--paper)' }}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

function MultiSelectDropdown({
    label,
    isOpen,
    onToggle,
    options,
    selected,
    onToggleOption,
    onClear,
    searchable = false,
    searchPlaceholder = 'Search...',
}: {
    label: string;
    isOpen: boolean;
    onToggle: () => void;
    options: FacetOption[];
    selected: string[];
    onToggleOption: (value: string) => void;
    onClear: () => void;
    searchable?: boolean;
    searchPlaceholder?: string;
}) {
    const [query, setQuery] = useState('');
    useEffect(() => {
        if (!isOpen) setQuery('');
    }, [isOpen]);

    const filtered = useMemo(() => {
        if (!query.trim()) return options;
        const q = query.trim().toLowerCase();
        return options.filter((opt) => opt.label.toLowerCase().includes(q));
    }, [options, query]);

    const activeLabel =
        selected.length === 0
            ? undefined
            : selected.length === 1
                ? options.find((o) => o.value === selected[0])?.label ?? selected[0]
                : `${selected.length} selected`;

    if (options.length === 0) return null;

    return (
        <DropdownTrigger label={label} activeLabel={activeLabel} isOpen={isOpen} onToggle={onToggle}>
            <div className="w-72 max-w-[85vw]">
                {searchable && (
                    <div className="p-2">
                        <input
                            type="text"
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={searchPlaceholder}
                            className="field text-sm"
                        />
                    </div>
                )}
                <div className={`flex flex-col gap-0.5 px-1.5 pb-1.5 ${searchable ? '' : 'pt-1.5'}`}>
                    {filtered.length === 0 && (
                        <p className="px-2 py-3 text-center text-xs" style={{ color: 'var(--muted)' }}>
                            No matches
                        </p>
                    )}
                    {filtered.map((opt) => (
                        <CheckRow
                            key={opt.value}
                            label={opt.label}
                            count={opt.count}
                            checked={selected.includes(opt.value)}
                            onClick={() => onToggleOption(opt.value)}
                        />
                    ))}
                </div>
                {selected.length > 0 && (
                    <div className="hr-line mx-1.5">
                        <button
                            type="button"
                            onClick={onClear}
                            className="btn btn-ghost w-full justify-start px-3 py-2 text-xs"
                        >
                            Clear {label.toLowerCase()} filter
                        </button>
                    </div>
                )}
            </div>
        </DropdownTrigger>
    );
}

function CheckRow({
    label,
    count,
    checked,
    onClick,
}: {
    label: string;
    count?: number;
    checked: boolean;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors touch-manipulation"
            style={{ background: checked ? 'var(--indigo-soft)' : 'transparent', color: checked ? 'var(--indigo)' : 'var(--ink)' }}
        >
            <span className="flex items-center gap-2 truncate">
                <span
                    aria-hidden
                    className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border"
                    style={{
                        borderColor: checked ? 'var(--indigo)' : 'var(--line-strong)',
                        background: checked ? 'var(--indigo)' : 'transparent',
                    }}
                >
                    {checked && (
                        <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                            <path d="M1.5 5L4 7.5L8.5 2.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    )}
                </span>
                <span className="truncate">{label}</span>
            </span>
            {typeof count === 'number' && (
                <span className="shrink-0 text-xs" style={{ color: 'var(--muted)' }}>
                    ({count})
                </span>
            )}
        </button>
    );
}

function CaretIcon() {
    return (
        <svg width="10" height="10" viewBox="0 0 10 6" fill="none" aria-hidden>
            <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

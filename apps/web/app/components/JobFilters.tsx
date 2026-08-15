import Link from 'next/link';

export type LocationFilter = 'all' | 'india' | 'remote' | 'japan';
export type GroupFilter = 'all' | 'software' | 'sales' | 'finance' | 'other';

const LOCATION_OPTIONS: { value: LocationFilter; label: string }[] = [
  { value: 'all', label: 'All locations' },
  { value: 'india', label: 'India' },
  { value: 'remote', label: 'Remote' },
  { value: 'japan', label: 'Japan' },
];

const GROUP_OPTIONS: { value: GroupFilter; label: string }[] = [
  { value: 'all', label: 'All roles' },
  { value: 'software', label: 'Software Engineer' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
  { value: 'other', label: 'Other' },
];

/**
 * Server-rendered filter pills for location (All / India / Remote / Japan)
 * and role group (Software Engineer / Sales / Finance / Other). Filters are
 * plain query params so pages stay statically linkable and crawlable —
 * no client JS required to use them.
 *
 * "India" is resolved client-side in the page (see lib/jobPriority.ts)
 * rather than sent to the API as a country param, because most India
 * listings (company career pages) have no `country` value set at all —
 * an exact-match API filter on the string "India" would miss them.
 */
export default function JobFilters({
  basePath,
  search,
  location,
  group,
}: {
  basePath: string;
  search: string;
  location: LocationFilter;
  group: GroupFilter;
}) {
  const buildHref = (nextLocation: LocationFilter, nextGroup: GroupFilter) => {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (nextLocation !== 'all') params.set('loc', nextLocation);
    if (nextGroup !== 'all') params.set('role', nextGroup);

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
        <span
          className="eyebrow text-[0.65rem] sm:text-xs mr-1"
          style={{ color: 'var(--ink-soft)' }}
        >
          location
        </span>
        {LOCATION_OPTIONS.map((opt) => (
          <Link
            key={opt.value}
            href={buildHref(opt.value, group)}
            className={`chip text-[0.7rem] sm:text-xs touch-manipulation ${
              location === opt.value ? 'chip-indigo' : 'chip-muted'
            }`}
          >
            {opt.label}
          </Link>
        ))}
      </div>

      <RoleFilter basePath={basePath} search={search} group={group} location={location} />
    </div>
  );
}

/**
 * Standalone role-only filter row, for pages (like /remote-jobs) where a
 * location pill row doesn't make sense — everything on that page is
 * already remote — but role filtering is still useful and the backend
 * already supports `job_group` for it.
 */
export function RoleFilter({
  basePath,
  search,
  group,
  location,
}: {
  basePath: string;
  search: string;
  group: GroupFilter;
  location?: LocationFilter;
}) {
  const buildHref = (nextGroup: GroupFilter) => {
    const params = new URLSearchParams();

    if (search) params.set('search', search);
    if (location && location !== 'all') params.set('loc', location);
    if (nextGroup !== 'all') params.set('role', nextGroup);

    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
      <span
        className="eyebrow text-[0.65rem] sm:text-xs mr-1"
        style={{ color: 'var(--ink-soft)' }}
      >
        role
      </span>
      {GROUP_OPTIONS.map((opt) => (
        <Link
          key={opt.value}
          href={buildHref(opt.value)}
          className={`chip text-[0.7rem] sm:text-xs touch-manipulation ${
            group === opt.value ? 'chip-indigo' : 'chip-muted'
          }`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}

export function parseLocationFilter(value: string | undefined): LocationFilter {
  return value === 'india' || value === 'remote' || value === 'japan' ? value : 'all';
}

export function parseGroupFilter(value: string | undefined): GroupFilter {
  return value === 'software' || value === 'sales' || value === 'finance' || value === 'other'
    ? value
    : 'all';
}

// Module: lib/seo/pagination.ts
// Pure helpers (no app imports, unit-testable) for canonical/title handling on paginated
// list pages (/jobs, /internships, /remote-jobs, /government-jobs).
//
// Every ?page=N used to canonicalise to page 1 (and robots.txt blocked ?page= outright),
// so Google could only ever see the first 12 jobs of each list and had no crawlable
// path to the rest. Page N is now self-canonical, which is Google's recommended
// pagination pattern; any filter/search parameter falls back to the base URL.

type Params = Record<string, string | string[] | undefined>;

export function listPageState(searchParams: Params = {}): { page: number; filtered: boolean } {
    const raw = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
    const parsed = Number.parseInt(raw ?? '1', 10);
    const page = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
    const filtered = Object.entries(searchParams).some(
        ([key, value]) => key !== 'page' && value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0),
    );
    return { page, filtered };
}

/** Canonical URL: `${baseUrl}${path}` for page 1 or any filtered view; `?page=N` otherwise. */
export function paginatedCanonical(baseUrl: string, path: string, searchParams: Params = {}): string {
    const { page, filtered } = listPageState(searchParams);
    return page > 1 && !filtered ? `${baseUrl}${path}?page=${page}` : `${baseUrl}${path}`;
}

/** Distinct titles for deeper pages so paginated URLs are not exact duplicates. */
export function paginatedTitle(title: string, page: number): string {
    return page > 1 ? `${title} — Page ${page}` : title;
}

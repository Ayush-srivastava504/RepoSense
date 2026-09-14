// Module: app/jobs-in/data.ts
// Defines component(s)/export(s): CITIES
// Defines function(s): getCityBySlug, getRelatedCities
// Defines type(s): CityDefinition

export interface CityDefinition {
    slug: string;
    name: string;
    region: string;
    // Lowercase substrings matched against a job's raw `location` string, since the
    // jobs API only filters by country server-side — city matching happens here.
    matchers: string[];
    metaTitle: string;
    metaDescription: string;
    heroDescription: string;
    relatedSlugs: string[];
}

function city(
    slug: string,
    name: string,
    region: string,
    matchers: string[],
    relatedSlugs: string[],
): CityDefinition {
    return {
        slug,
        name,
        region,
        matchers,
        metaTitle: `Jobs & Internships in ${name} — Live Openings, Updated Daily`,
        metaDescription: `Live jobs and internships based in ${name}, sourced from company career pages and job boards and refreshed daily, plus the resume and interview tools to apply faster.`,
        heroDescription: `Every active job and internship listed for ${name} on InternFlow, aggregated from company career pages and job boards and refreshed daily — with the companies hiring and the tools to get your application ready.`,
        relatedSlugs,
    };
}

export const CITIES: CityDefinition[] = [
    city('bangalore', 'Bangalore', 'Karnataka', ['bangalore', 'bengaluru'], ['hyderabad', 'chennai', 'pune']),
    city('hyderabad', 'Hyderabad', 'Telangana', ['hyderabad', 'secunderabad'], ['bangalore', 'chennai', 'pune']),
    city('chennai', 'Chennai', 'Tamil Nadu', ['chennai'], ['bangalore', 'hyderabad', 'pune']),
    city('pune', 'Pune', 'Maharashtra', ['pune'], ['bangalore', 'hyderabad', 'delhi-ncr']),
    city('delhi-ncr', 'Delhi NCR', 'Delhi / NCR', ['delhi', 'new delhi', 'gurugram', 'gurgaon', 'noida', 'faridabad', 'ghaziabad', 'ncr'], ['pune', 'bangalore', 'hyderabad']),
];

export function getCityBySlug(slug: string): CityDefinition | undefined {
    return CITIES.find((c) => c.slug === slug);
}

// Reverse lookup used by ExploreRelated.tsx: given a job's raw `location`
// string (e.g. "Bengaluru, Karnataka"), find the matching /jobs-in/[city]
// hub page, if any, so the job detail page can link to it. Returns
// undefined for locations with no dedicated hub (e.g. tier-2 cities) —
// callers should just omit the link rather than force a match.
export function getCityForLocation(location: string | undefined | null): CityDefinition | undefined {
    if (!location) return undefined;
    const normalized = location.toLowerCase();
    return CITIES.find((c) => c.matchers.some((m) => normalized.includes(m)));
}

export function getRelatedCities(current: CityDefinition): CityDefinition[] {
    return current.relatedSlugs
        .map((slug) => getCityBySlug(slug))
        .filter((c): c is CityDefinition => Boolean(c));
}

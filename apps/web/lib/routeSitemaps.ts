// Module: lib/routeSitemaps.ts
// The ten NON-job sitemaps (static, hackathons, tools, blog, skills, companies, locations, batches, resume, careers),
// as data: how to build each, what to serve when the API is down, and its cheap <lastmod> for the sitemap index.
// app/sitemap-<slug>.xml/route.ts is a one-liner over serveRouteSitemap(); app/sitemap.xml/route.ts reads
// routeSitemapLastmod() for each <sitemap> entry.
//
// <lastmod> policy: a date is only ever a real timestamp from our data, never "now" and never the deploy time. If it
// cannot be determined the tag is omitted. For every page that renders a live job list the date is the newest posted
// date among EXACTLY the jobs that page renders (the same query the page makes: same filter, sort and limit), so it
// moves only when the page's visible list can have changed. tools has no date on purpose (static copy).
import { BASE_URL, getJobsOrThrow, type Job } from '@/lib/jobs';
import { getHackathonsOrThrow } from '@/lib/hackathons';
import { getCompaniesOrThrow, getIntelSitemapEntries, getCompanyDirectory, companySlug } from '@/lib/companies';
import { getJobFacetsOrThrow } from '@/lib/facets';
import { getAllPosts } from '@/lib/blog';
import { hreflangLinks } from '@/lib/hreflang';
import { mapWithLimit, serveSitemap, type SitemapBuild } from '@/lib/sitemapResponse';
import { buildUrlsetXml, toLastmod, type SitemapUrlEntry } from '@/lib/sitemapXml';
import { newestJobDate, newestLastmod } from '@/lib/sitemapDates';
import { SKILLS } from '@/app/skills/data';
import { TOOLS } from '@/app/tools/data';
import { COMPARISONS } from '@/app/tools/comparisons';
import { CITIES, type CityDefinition } from '@/app/jobs-in/data';
import { BATCHES } from '@/app/batch/data';
import { CAREERS } from '@/app/careers/data';
import { RESUME_ROLES } from '@/app/resume-for/data';
import { COMPANY_MIN_JOBS, SKILL_MIN_JOBS, LOCATION_MIN_JOBS, BATCH_MIN_JOBS, belowHubThreshold } from '@/lib/seo/hubThresholds';

export interface RouteSitemap {
    /** sitemap_categories.slug */
    slug: string;
    /** Public path, as registered in sitemap_categories.path */
    path: string;
    build(): Promise<SitemapBuild>;
    /** Built from data that ships with the app only. Must be a complete-as-possible list, never throws. */
    fallback(): SitemapBuild;
    /**
     * Cheap newest-change date for the index. undefined = this sitemap has no honest date (tag omitted).
     * Throws when the API needed to know it is unavailable; the index decides what that means.
     */
    lastmod(): Promise<string | undefined>;
}

function done(entries: SitemapUrlEntry[]): SitemapBuild {
    return { xml: buildUrlsetXml(entries), lastmod: newestLastmod(entries.map((e) => e.lastmod)) };
}

/**
 * Newest posted job anywhere. One small API call (itself cached). THROWS when the API is unavailable: a build that
 * quietly dropped its dates would be cached as a good copy and replace the dated one for an hour.
 */
export async function getLatestJobDate(): Promise<string | undefined> {
    return newestJobDate(await getJobsOrThrow({ limit: 20, sort: 'recent' }));
}

type JobQuery = Parameters<typeof getJobsOrThrow>[0];

/** Newest posted date among the jobs a hub page actually renders. Throws if the API is unavailable. */
async function renderedJobsDate(queries: JobQuery[]): Promise<string | undefined> {
    const lists = await Promise.all(queries.map((q) => getJobsOrThrow(q)));
    return newestJobDate(lists.flat());
}

// ---------------------------------------------------------------- static
const CORE_HUBS = [
    { path: '', changefreq: 'daily' as const, priority: 1.0, live: true },
    { path: '/jobs', changefreq: 'daily' as const, priority: 0.9, live: true },
    { path: '/internships', changefreq: 'daily' as const, priority: 0.9, live: true },
    { path: '/remote-jobs', changefreq: 'daily' as const, priority: 0.9, live: true },
    { path: '/government-jobs', changefreq: 'daily' as const, priority: 0.9, live: true },
    { path: '/companies', changefreq: 'daily' as const, priority: 0.8, live: true },
    { path: '/hackathons', changefreq: 'daily' as const, priority: 0.8, live: true },
    { path: '/japan-jobs', changefreq: 'daily' as const, priority: 0.8, live: true },
    { path: '/europe-jobs', changefreq: 'daily' as const, priority: 0.8, live: true },
    { path: '/tools', changefreq: 'weekly' as const, priority: 0.8, live: false },
    { path: '/about', changefreq: 'monthly' as const, priority: 0.6, live: false },
    { path: '/contact', changefreq: 'yearly' as const, priority: 0.3, live: false },
    { path: '/privacy', changefreq: 'yearly' as const, priority: 0.3, live: false },
    { path: '/terms', changefreq: 'yearly' as const, priority: 0.3, live: false },
    { path: '/leetcode', changefreq: 'weekly' as const, priority: 0.7, live: false },
    { path: '/resume/builder', changefreq: 'monthly' as const, priority: 0.7, live: false },
    { path: '/ats-checker', changefreq: 'monthly' as const, priority: 0.7, live: false },
    { path: '/cover-letter', changefreq: 'monthly' as const, priority: 0.7, live: false },
    { path: '/github', changefreq: 'monthly' as const, priority: 0.7, live: false },
    { path: '/linkedin', changefreq: 'monthly' as const, priority: 0.7, live: false },
    // /login and /register deliberately excluded: noindexed via middleware.ts NOINDEX_PREFIXES (a sitemap entry for a
    // noindexed page is a conflicting signal).
];

// The queries each live hub page makes for its first page of results (see app/<hub>/page.tsx).
const HUB_QUERIES: Record<string, JobQuery[]> = {
    '/jobs': [{ excludeGovernment: true, excludeType: 'internship', sort: 'ranked', limit: 12 }],
    '/internships': [{ type: 'internship', excludeGovernment: true, sort: 'ranked', limit: 12 }],
    '/remote-jobs': [{ category: 'remote', excludeGovernment: true, excludeType: 'internship', sort: 'ranked', limit: 12 }],
    '/government-jobs': [{ category: 'government', sort: 'ranked', limit: 12 }],
    '/japan-jobs': [{ country: 'Japan', sort: 'ranked', limit: 12 }],
    '/europe-jobs': [{ country: 'Europe', sort: 'ranked', limit: 12 }],
};

/** path -> lastmod for the live hubs of the static sitemap. */
async function staticHubDates(): Promise<Record<string, string | undefined>> {
    const paths = Object.keys(HUB_QUERIES);
    const [perHub, latest, hackathons] = await Promise.all([
        mapWithLimit(paths, 3, (p) => renderedJobsDate(HUB_QUERIES[p])),
        getLatestJobDate(),
        getHackathonsOrThrow({ limit: HACKATHON_PAGE_SIZE, offset: 0 }),
    ]);
    const dates: Record<string, string | undefined> = { '': latest, '/companies': latest, '/hackathons': newestLastmod(hackathons.map((h) => h.first_seen_at)) };
    paths.forEach((p, i) => { dates[p] = perHub[i]; });
    return dates;
}

function staticEntries(dates: Record<string, string | undefined> = {}): SitemapUrlEntry[] {
    return CORE_HUBS.map((hub) => ({
        loc: `${BASE_URL}${hub.path}`,
        lastmod: hub.live ? dates[hub.path] : undefined,
        changefreq: hub.changefreq,
        priority: hub.priority,
        // Empty while hreflang is disabled (lib/hreflang.ts) -> plain <urlset>, no xhtml namespace.
        alternates: hreflangLinks(hub.path),
    }));
}

const staticSitemap: RouteSitemap = {
    slug: 'static',
    path: '/sitemap-static.xml',
    build: async () => done(staticEntries(await staticHubDates())),
    fallback: () => done(staticEntries()),
    lastmod: async () => newestLastmod(Object.values(await staticHubDates())),
};

// ---------------------------------------------------------------- hackathons
const HACKATHON_PAGE_SIZE = 50;
const HACKATHON_MAX_PAGES = 20;

function hackathonEntries(hackathons: { slug?: string; first_seen_at?: string }[]): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/hackathons`, lastmod: newestLastmod(hackathons.map((h) => h.first_seen_at)), changefreq: 'daily', priority: 0.8 },
        ...hackathons
            .filter((h) => h?.slug)
            .map((h) => ({
                loc: `${BASE_URL}/hackathons/${h.slug}`,
                lastmod: toLastmod(h.first_seen_at),
                changefreq: 'daily' as const,
                priority: 0.7,
            })),
    ];
}

const hackathonsSitemap: RouteSitemap = {
    slug: 'hackathons',
    path: '/sitemap-hackathons.xml',
    build: async () => {
        // Small concurrent batches: fully sequential can outrun the function timeout (truncated XML = "Missing XML tag"),
        // all pages at once bursts the API's per-minute limit. Any failed page rejects -> serveSitemap's fallback layers,
        // never a silently partial list.
        const BATCH_CONCURRENCY = 5;
        let hackathons: Awaited<ReturnType<typeof getHackathonsOrThrow>> = [];
        outer: for (let batchStart = 0; batchStart < HACKATHON_MAX_PAGES; batchStart += BATCH_CONCURRENCY) {
            const pages = Array.from({ length: Math.min(BATCH_CONCURRENCY, HACKATHON_MAX_PAGES - batchStart) }, (_, i) => batchStart + i);
            const results = await Promise.all(pages.map((page) => getHackathonsOrThrow({ limit: HACKATHON_PAGE_SIZE, offset: page * HACKATHON_PAGE_SIZE })));
            for (const items of results) {
                hackathons = hackathons.concat(items);
                if (items.length < HACKATHON_PAGE_SIZE) break outer;
            }
        }
        return done(hackathonEntries(hackathons));
    },
    // The list only exists in the API; the hub is the one URL that is always valid.
    fallback: () => done([{ loc: `${BASE_URL}/hackathons`, changefreq: 'daily', priority: 0.8 }]),
    lastmod: async () => newestLastmod((await getHackathonsOrThrow({ limit: HACKATHON_PAGE_SIZE, offset: 0 })).map((h) => h.first_seen_at)),
};

// ---------------------------------------------------------------- tools
function toolsEntries(): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/tools`, changefreq: 'weekly', priority: 0.8 },
        ...TOOLS.map((tool) => ({ loc: `${BASE_URL}/tools/${tool.slug}`, changefreq: 'weekly' as const, priority: 0.7 })),
        ...COMPARISONS.map((c) => ({
            loc: `${BASE_URL}/tools/${c.toolSlug}/vs/${c.competitorSlug}`,
            changefreq: 'weekly' as const,
            priority: 0.6,
        })),
    ];
}

const toolsSitemap: RouteSitemap = {
    slug: 'tools',
    path: '/sitemap-tools.xml',
    build: async () => done(toolsEntries()),
    fallback: () => done(toolsEntries()),
    lastmod: async () => undefined, // static copy: no honest date to give, so none is given
};

// ---------------------------------------------------------------- blog
function blogEntries(): SitemapUrlEntry[] {
    const posts = getAllPosts();
    return [
        {
            loc: `${BASE_URL}/blog`,
            lastmod: newestLastmod(posts.map((p) => p.updatedAt || p.publishedAt)),
            changefreq: 'daily',
            priority: 0.9,
            alternates: hreflangLinks('/blog'),
        },
        ...posts.map((post) => ({
            loc: `${BASE_URL}/blog/${post.slug}`,
            lastmod: post.updatedAt || post.publishedAt,
            changefreq: 'weekly' as const,
            priority: 0.8,
            alternates: hreflangLinks(`/blog/${post.slug}`),
        })),
    ];
}

const blogSitemap: RouteSitemap = {
    slug: 'blog',
    path: '/sitemap-blog.xml',
    build: async () => done(blogEntries()),
    fallback: () => done(blogEntries()),
    lastmod: async () => newestLastmod(getAllPosts().map((p) => p.updatedAt || p.publishedAt)),
};

// ---------------------------------------------------------------- skills
type SkillStat = { count: number; lastmod?: string };

function skillsEntries(stats: SkillStat[] | null, latestJob?: string): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/skills`, lastmod: latestJob, changefreq: 'weekly', priority: 0.8 },
        ...SKILLS
            // Below SKILL_MIN_JOBS the hub renders noindex, so it must not be in the sitemap (conflicting signal).
            // `stats === null` is the static fallback: every hub is listed, so the sitemap can never shrink.
            .filter((_, i) => !stats || !belowHubThreshold(stats[i].count, SKILL_MIN_JOBS))
            .map((skill) => {
                const i = SKILLS.indexOf(skill);
                return {
                    loc: `${BASE_URL}/skills/${skill.slug}`,
                    lastmod: stats?.[i]?.lastmod,
                    changefreq: 'daily' as const,
                    priority: 0.7,
                };
            }),
    ];
}

const skillsSitemap: RouteSitemap = {
    slug: 'skills',
    path: '/sitemap-skills.xml',
    build: async () => {
        // getJobsOrThrow: an API failure would otherwise count as 0 jobs and drop EVERY skill hub from the sitemap.
        // 4 skills at a time (8 API calls) instead of all at once against a 1 GB API box.
        const stats = await mapWithLimit(SKILLS, 4, async (skill): Promise<SkillStat> => {
            const [jobs, internships] = await Promise.all([
                getJobsOrThrow({ skill: skill.searchTerm, type: undefined, limit: 9, sort: 'ranked' }),
                getJobsOrThrow({ skill: skill.searchTerm, type: 'internship', limit: 6, sort: 'ranked' }),
            ]);
            return { count: jobs.length + internships.length, lastmod: newestJobDate([...jobs, ...internships]) };
        });
        return done(skillsEntries(stats, newestLastmod(stats.map((s) => s.lastmod))));
    },
    fallback: () => done(skillsEntries(null)),
    lastmod: getLatestJobDate,
};

// ---------------------------------------------------------------- locations
// Same matcher app/jobs-in/[city]/page.tsx uses: the jobs API only filters by country server-side.
function matchesCity(job: Job, city: CityDefinition): boolean {
    const loc = (job.location || '').toLowerCase();
    if (!loc) return false;
    return city.matchers.some((m) => loc.includes(m));
}

function locationEntries(perCity: { count: number; lastmod?: string }[] | null, hubLastmod?: string): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/jobs-in`, lastmod: hubLastmod, changefreq: 'weekly', priority: 0.8 },
        ...CITIES.flatMap((city, i) => {
            if (perCity && belowHubThreshold(perCity[i].count, LOCATION_MIN_JOBS)) return [];
            return [{ loc: `${BASE_URL}/jobs-in/${city.slug}`, lastmod: perCity?.[i]?.lastmod, changefreq: 'daily' as const, priority: 0.7 }];
        }),
    ];
}

const locationsSitemap: RouteSitemap = {
    slug: 'locations',
    path: '/sitemap-locations.xml',
    build: async () => {
        // One fetch of both job types, filtered per city in memory. getJobsOrThrow so an API failure is not "0 jobs".
        const [jobs, internships] = await Promise.all([
            getJobsOrThrow({ sort: 'ranked', limit: 500 }),
            getJobsOrThrow({ type: 'internship', sort: 'ranked', limit: 500 }),
        ]);
        const perCity = CITIES.map((city) => {
            const matched = [...jobs.filter((j) => matchesCity(j, city)), ...internships.filter((j) => matchesCity(j, city))];
            return { count: matched.length, lastmod: newestJobDate(matched) };
        });
        return done(locationEntries(perCity, newestLastmod(perCity.map((c) => c.lastmod))));
    },
    fallback: () => done(locationEntries(null)),
    lastmod: getLatestJobDate,
};

// ---------------------------------------------------------------- batches
/** year -> newest posted date among the jobs /batch/<year> renders (same two queries as the page). */
async function batchDates(): Promise<Map<string, string | undefined>> {
    const dates = await mapWithLimit(BATCHES, 3, (b) =>
        renderedJobsDate([
            { batches: [b.year], type: undefined, limit: 9, sort: 'ranked' },
            { batches: [b.year], type: 'internship', limit: 6, sort: 'ranked' },
        ]));
    return new Map(BATCHES.map((b, i) => [b.year, dates[i]]));
}

function batchEntries(countByYear: Map<string, number> | null, dates: Map<string, string | undefined> = new Map()): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/batch`, lastmod: newestLastmod([...dates.values()]), changefreq: 'weekly', priority: 0.8 },
        ...BATCHES
            // A year absent from the facets (zero live jobs) counts as 0 and is dropped (noindex gate, as before).
            .filter((b) => !countByYear || !belowHubThreshold(countByYear.get(b.year) ?? 0, BATCH_MIN_JOBS))
            .map((b) => ({ loc: `${BASE_URL}/batch/${b.year}`, lastmod: dates.get(b.year), changefreq: 'daily' as const, priority: 0.7 })),
    ];
}

const batchesSitemap: RouteSitemap = {
    slug: 'batches',
    path: '/sitemap-batches.xml',
    build: async () => {
        // getJobFacetsOrThrow: an API failure would otherwise count every year as 0 jobs and drop all batch pages.
        const facets = await getJobFacetsOrThrow();
        const countByYear = new Map(facets.batches.map((b) => [b.value, b.count]));
        return done(batchEntries(countByYear, await batchDates()));
    },
    fallback: () => done(batchEntries(null)),
    lastmod: async () => newestLastmod([...(await batchDates()).values()]),
};

// ---------------------------------------------------------------- careers / resume-for
/** slug -> newest posted date among the jobs /careers/<slug> renders (same two queries as the page). */
async function careerDates(): Promise<Map<string, string | undefined>> {
    const dates = await mapWithLimit(CAREERS, 3, (c) =>
        renderedJobsDate([
            { search: c.searchTerm, type: undefined, limit: 6, sort: 'ranked' },
            { search: c.searchTerm, type: 'internship', limit: 6, sort: 'ranked' },
        ]));
    return new Map(CAREERS.map((c, i) => [c.slug, dates[i]]));
}

function careerEntries(dates: Map<string, string | undefined> = new Map()): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/careers`, lastmod: newestLastmod([...dates.values()]), changefreq: 'weekly', priority: 0.8 },
        ...CAREERS.map((c) => ({ loc: `${BASE_URL}/careers/${c.slug}`, lastmod: dates.get(c.slug), changefreq: 'daily' as const, priority: 0.7 })),
    ];
}

const careersSitemap: RouteSitemap = {
    slug: 'careers',
    path: '/sitemap-careers.xml',
    build: async () => done(careerEntries(await careerDates())),
    fallback: () => done(careerEntries()),
    lastmod: async () => newestLastmod([...(await careerDates()).values()]),
};

/** slug -> newest posted date among the openings /resume-for/<slug> renders (same query as the page). */
async function resumeDates(): Promise<Map<string, string | undefined>> {
    const dates = await mapWithLimit(RESUME_ROLES, 3, (r) => renderedJobsDate([{ search: r.searchTerm, sort: 'ranked', limit: 12 }]));
    return new Map(RESUME_ROLES.map((r, i) => [r.slug, dates[i]]));
}

function resumeEntries(dates: Map<string, string | undefined> = new Map()): SitemapUrlEntry[] {
    return [
        { loc: `${BASE_URL}/resume-for`, lastmod: newestLastmod([...dates.values()]), changefreq: 'weekly', priority: 0.8 },
        ...RESUME_ROLES.map((r) => ({ loc: `${BASE_URL}/resume-for/${r.slug}`, lastmod: dates.get(r.slug), changefreq: 'weekly' as const, priority: 0.7 })),
    ];
}

const resumeSitemap: RouteSitemap = {
    slug: 'resume',
    path: '/sitemap-resume.xml',
    build: async () => done(resumeEntries(await resumeDates())),
    fallback: () => done(resumeEntries()),
    lastmod: async () => newestLastmod([...(await resumeDates()).values()]),
};

// ---------------------------------------------------------------- companies
function companyEntries(
    all: { company?: string; job_count: number; last_posted_at?: string | null }[],
    letters: { letter: string }[],
    intelOnly: { slug: string; updated_at: string | null }[],
): SitemapUrlEntry[] {
    const companies = all.filter((c) => c.company && c.job_count >= COMPANY_MIN_JOBS);
    const hubLastmod = newestLastmod([...companies.map((c) => c.last_posted_at), ...intelOnly.map((e) => e.updated_at)]);
    return [
        { loc: `${BASE_URL}/companies`, lastmod: hubLastmod, changefreq: 'daily', priority: 0.8 },
        ...letters.map((l) => ({ loc: `${BASE_URL}/company-directory/${l.letter}`, lastmod: hubLastmod, changefreq: 'daily' as const, priority: 0.5 })),
        ...companies.map((c) => ({
            loc: `${BASE_URL}/companies/${companySlug(c.company as string)}`,
            lastmod: toLastmod(c.last_posted_at),
            changefreq: 'daily' as const,
            priority: 0.6,
        })),
        ...intelOnly.map((e) => ({
            loc: `${BASE_URL}/companies/${e.slug}`,
            lastmod: toLastmod(e.updated_at),
            changefreq: 'weekly' as const,
            priority: 0.5,
        })),
    ];
}

const companiesSitemap: RouteSitemap = {
    slug: 'companies',
    path: '/sitemap-companies.xml',
    build: async () => {
        // 200 is the API's hard cap (limit_per_section, le=200); requesting more 422s.
        const { top, mass_hire, startup } = await getCompaniesOrThrow(200);
        const all = [...top.companies, ...mass_hire.companies, ...startup.companies];
        // Only slugs actually emitted count as known; otherwise a company with 1 job and 5+ topics is dropped from both lists.
        const known = new Set(all.filter((c) => c.company && c.job_count >= COMPANY_MIN_JOBS).map((c) => companySlug(c.company)));
        // Companies with enough published topics are indexable even with no live jobs / past the 200 cap.
        const intelOnly = (await getIntelSitemapEntries()).filter((e) => !known.has(e.slug));
        const letters = (await getCompanyDirectory())?.letters ?? [];
        return done(companyEntries(all, letters, intelOnly));
    },
    // The company list only exists in the API. Last resort only (data cache AND memory cold AND API down): the hub.
    fallback: () => done([{ loc: `${BASE_URL}/companies`, changefreq: 'daily', priority: 0.8 }]),
    lastmod: getLatestJobDate,
};

// ---------------------------------------------------------------- registry
export const ROUTE_SITEMAPS: RouteSitemap[] = [
    staticSitemap,
    hackathonsSitemap,
    toolsSitemap,
    blogSitemap,
    skillsSitemap,
    companiesSitemap,
    locationsSitemap,
    batchesSitemap,
    resumeSitemap,
    careersSitemap,
];

export function routeSitemapBySlug(slug: string): RouteSitemap {
    const found = ROUTE_SITEMAPS.find((s) => s.slug === slug);
    if (!found) throw new Error(`unknown route sitemap "${slug}"`);
    return found;
}

export function routeSitemapByPath(path: string): RouteSitemap | undefined {
    return ROUTE_SITEMAPS.find((s) => s.path === path);
}

/** Body of every app/sitemap-<slug>.xml/route.ts. */
export function serveRouteSitemap(slug: string): Promise<Response> {
    const s = routeSitemapBySlug(slug);
    return serveSitemap(s.slug, s.build, s.fallback);
}

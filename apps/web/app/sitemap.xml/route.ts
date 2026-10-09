// Module: app/sitemap.xml/route.ts
// The master index. Each <sitemap> carries a <lastmod> (the newest real change in that child), which is what lets
// Google decide which children are worth re-reading today instead of guessing.
import { BASE_URL } from '@/lib/jobs';
import { serveSitemap, type SitemapBuild } from '@/lib/sitemapResponse';
import { getSitemapCategories, getSitemapFileList, type SitemapFileInfo } from '@/lib/sitemapJobsSource';
import { ROUTE_SITEMAPS, routeSitemapByPath } from '@/lib/routeSitemaps';
import { newestLastmod } from '@/lib/sitemapDates';
import { toLastmod } from '@/lib/sitemapXml';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface IndexEntry {
    loc: string;
    lastmod?: string;
}

// Job categories whose files are prebuilt by the API; used only by the static fallback below, where the real file list
// is unknown. `-1` always exists for a category that has any URLs.
const FALLBACK_JOB_FILES = ['jobs-1.xml', 'internships-1.xml', 'remote-jobs-1.xml', 'government-jobs-1.xml'];

function renderIndex(entries: IndexEntry[]): SitemapBuild {
    const body = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries
        .map((e) => `  <sitemap>
    <loc>${e.loc}</loc>${e.lastmod ? `\n    <lastmod>${e.lastmod}</lastmod>` : ''}
  </sitemap>`)
        .join('\n')}
</sitemapindex>`;
    return { xml: body, lastmod: newestLastmod(entries.map((e) => e.lastmod)) };
}

/**
 * A child's lastmod, or an Error. Kept separate so buildIndex can tell "this one endpoint is broken" (omit that tag) from
 * "the API is down" (most lookups fail: do NOT publish an index stripped of its dates; serve the last dated copy).
 */
async function routeLastmod(path: string): Promise<string | undefined> {
    return routeSitemapByPath(path)?.lastmod();
}

async function routeEntries(paths: string[]): Promise<IndexEntry[]> {
    const settled = await Promise.allSettled(paths.map((p) => routeLastmod(p)));
    const failed = settled.filter((r) => r.status === 'rejected').length;
    const ok = settled.length - failed;
    if (failed > ok)
        throw new Error(`sitemap index: ${failed}/${settled.length} lastmod lookups failed, the API looks down`);
    for (const r of settled)
        if (r.status === 'rejected') console.warn('sitemap index: omitting a lastmod:', r.reason);
    return paths.map((p, i) => {
        const r = settled[i];
        return { loc: `${BASE_URL}${p}`, lastmod: r.status === 'fulfilled' ? r.value : undefined };
    });
}

function jobFileEntries(files: SitemapFileInfo[]): IndexEntry[] {
    return files.map((f) => ({ loc: `${BASE_URL}/sitemaps/${f.file_name}`, lastmod: toLastmod(f.built_at) }));
}

async function buildIndex(): Promise<SitemapBuild> {
    // Throws when the job file list is unavailable and unknown: serveSitemap then serves the last good index or the
    // static fallback. We never publish an index that silently drops the job files.
    const files = jobFileEntries(await getSitemapFileList());
    const categories = await getSitemapCategories();
    let entries: IndexEntry[];
    if (categories) {
        // Registry order is authoritative. Job categories expand to their prebuilt files; a disabled job category has no
        // files after the next build, but filter here too so the index flips at once.
        const enabledJobSlugs = new Set(categories.filter((c) => c.kind === 'job_cache').map((c) => c.slug));
        const fileEntries = files.filter((f) => enabledJobSlugs.has(f.loc.split('/').pop()?.replace(/-\d+\.xml$/, '') ?? ''));
        const routePaths = categories.filter((c) => c.kind === 'route' && c.path).map((c) => c.path as string);
        const routes = new Map((await routeEntries(routePaths)).map((e) => [e.loc, e]));
        entries = [];
        let jobsInserted = false;
        for (const c of categories) {
            if (c.kind === 'route' && c.path) {
                entries.push(routes.get(`${BASE_URL}${c.path}`) as IndexEntry);
            }
            else if (c.kind === 'job_cache' && !jobsInserted) {
                entries.push(...fileEntries);
                jobsInserted = true;
            }
        }
    }
    else {
        // Registry unavailable: the built-in order (first route, then job files, then the rest).
        const [first, ...rest] = await routeEntries(ROUTE_SITEMAPS.map((s) => s.path));
        entries = [first, ...files, ...rest];
    }
    return renderIndex(entries);
}

function fallbackIndex(): SitemapBuild {
    const routes = ROUTE_SITEMAPS.map((s) => ({ loc: `${BASE_URL}${s.path}` }));
    const jobs = FALLBACK_JOB_FILES.map((f) => ({ loc: `${BASE_URL}/sitemaps/${f}` }));
    const [first, ...rest] = routes;
    return renderIndex([first, ...jobs, ...rest]);
}

export const GET = (req: Request) => serveSitemap('index', buildIndex, fallbackIndex, req);

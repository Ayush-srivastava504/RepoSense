// Module: lib/sitemapJobsSource.ts
// Server-side source for the category job sitemaps. The files are PREBUILT by the
// API (services/api/scripts/build_sitemaps.py -> sitemap_cache table, hourly), so a
// sitemap request is one or two cheap reads instead of ~28 paginated /api/jobs calls.
// The last good response is kept in memory: a brief API blip serves stale data
// instead of a 503.

import { fetchWithTimeout } from '@/lib/fetchWithTimeout';
import { BASE_URL } from '@/lib/site';

const API_BASE_URL = process.env.API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    'https://api.intern-flow.in';

export type SitemapFileInfo = { file_name: string; url_count: number };

export type SitemapRegistryEntry = { slug: string; kind: 'job_cache' | 'route'; path: string | null; sort_order: number };

let lastCategories: SitemapRegistryEntry[] | null = null;
let lastList: SitemapFileInfo[] | null = null;
const lastXml = new Map<string, string>();

export async function getSitemapFileList(): Promise<SitemapFileInfo[]> {
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/sitemap/files`, { next: { revalidate: 600 } }, 10000);
        if (!res.ok)
            throw new Error(`sitemap file list: HTTP ${res.status}`);
        const body = (await res.json()) as { files?: SitemapFileInfo[] };
        if (!body.files?.length)
            throw new Error('sitemap file list empty');
        lastList = body.files;
        return body.files;
    }
    catch (err) {
        if (lastList)
            return lastList;
        throw err;
    }
}

/** null = the API says the file doesn't exist; throws on transient failure. */
export async function getSitemapFileXml(name: string): Promise<string | null> {
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/sitemap/files/${encodeURIComponent(name)}`, { next: { revalidate: 600 } }, 15000);
        if (res.status === 404) {
            lastXml.delete(name);
            return null;
        }
        if (!res.ok)
            throw new Error(`sitemap file ${name}: HTTP ${res.status}`);
        const xml = await res.text();
        lastXml.set(name, xml);
        return xml;
    }
    catch (err) {
        const stale = lastXml.get(name);
        if (stale)
            return stale;
        throw err;
    }
}

export function sitemapFileUrls(files: SitemapFileInfo[]): string[] {
    return files.map((f) => `${BASE_URL}/sitemaps/${f.file_name}`);
}

/**
 * Enabled sitemap_categories rows (migration 030), or null when the registry is
 * unavailable -- callers fall back to their built-in list, so a registry problem
 * never takes the index down.
 */
export async function getSitemapCategories(): Promise<SitemapRegistryEntry[] | null> {
    try {
        const res = await fetchWithTimeout(`${API_BASE_URL}/api/sitemap/categories`, { next: { revalidate: 600 } }, 8000);
        if (!res.ok)
            throw new Error(`sitemap categories: HTTP ${res.status}`);
        const body = (await res.json()) as { categories?: SitemapRegistryEntry[] };
        if (!body.categories?.length)
            throw new Error('sitemap categories empty');
        lastCategories = body.categories;
        return body.categories;
    }
    catch (err) {
        console.warn('Sitemap registry unavailable, using built-in list:', err);
        return lastCategories;
    }
}

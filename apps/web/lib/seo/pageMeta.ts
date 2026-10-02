// Module: lib/seo/pageMeta.ts
// Defines function(s): pageOpenGraph, listingMetadata
//
// One place that builds a page's openGraph + twitter blocks. A page-level `openGraph` REPLACES the root
// layout's wholesale (Next does not deep-merge it), so every page that sets its own title/description must
// also repeat siteName and locale, and set og:url to its own canonical -- otherwise a share of /remote-jobs
// shows the homepage's title, description and URL. Centralised here so the four list pages and the four
// detail routes cannot drift apart.

import type { Metadata } from 'next';
import { BASE_URL } from '../site';
import { listPageState, paginatedCanonical, paginatedTitle } from './pagination';

export const OG_SITE_NAME = 'InternFlow';
export const OG_LOCALE = 'en_IN';
export const TWITTER_CREATOR = '@internflow_in';
export const DEFAULT_OG_IMAGE = `${BASE_URL}/og-image.png`;

export function pageOpenGraph(params: {
    title: string;
    description: string;
    /** Absolute URL; should equal the page's <link rel="canonical">. */
    url: string;
    image?: string;
    imageAlt?: string;
}): Pick<Metadata, 'openGraph' | 'twitter'> {
    const image = params.image ?? DEFAULT_OG_IMAGE;
    return {
        openGraph: {
            type: 'website',
            siteName: OG_SITE_NAME,
            locale: OG_LOCALE,
            url: params.url,
            title: params.title,
            description: params.description,
            images: [{ url: image, width: 1200, height: 630, alt: params.imageAlt ?? params.title }],
        },
        twitter: {
            card: 'summary_large_image',
            creator: TWITTER_CREATOR,
            title: params.title,
            description: params.description,
            images: [image],
        },
    };
}

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * Full metadata for a paginated list page (/jobs, /internships, /remote-jobs, /government-jobs):
 * paginated title, self-referencing canonical (page N canonicalises to itself, filtered views to the base
 * URL), hreflang only on the plain first page, and a matching openGraph/twitter block.
 */
export function listingMetadata(params: {
    path: string;
    title: string;
    description: string;
    searchParams: SearchParams;
    imageAlt: string;
    languages?: Record<string, string>;
}): Metadata {
    const { page, filtered } = listPageState(params.searchParams);
    const title = paginatedTitle(params.title, page);
    const canonical = paginatedCanonical(BASE_URL, params.path, params.searchParams);
    return {
        title,
        description: params.description,
        alternates: {
            canonical,
            ...(page === 1 && !filtered && params.languages ? { languages: params.languages } : {}),
        },
        ...pageOpenGraph({ title, description: params.description, url: canonical, imageAlt: params.imageAlt }),
    };
}

// Module: lib/seo/seoMetrics.ts
// Defines function(s): estimatePixelWidth, truncateTitleForSerp, truncateDescription, buildJobTitle
//
// PHASE 1 — ports FresherFlow's pixel-width title truncation
// (apps/web/src/app/(public)/jobs/[slug]/opportunitySeo.ts) so job-detail
// <title> tags get cut at Google's actual desktop SERP width (~580px)
// instead of an arbitrary character count. A plain character-count cutoff
// either wastes ~15-20 characters of unused SERP space on narrow-character
// titles ("IIIT Intern...") or overflows and gets Google's own ellipsis
// truncation on wide-character ones ("QA / Mobile Web Developer...") —
// neither of which a fixed character limit can tell apart.

// Approximate per-character pixel widths for a standard SERP font
// (Arial/Roboto ~13px), bucketed by character class. Not a real font
// metrics table — good enough to get materially closer to the 580px
// budget than a character-count heuristic, which is the actual bar here.
const NARROW_CHARS = new Set('iIl1.,:;\'|!ftj'.split(''));
const WIDE_CHARS = new Set('mMWw@%&'.split(''));

function charWidth(ch: string): number {
    if (ch === ' ') return 4;
    if (NARROW_CHARS.has(ch)) return 5;
    if (WIDE_CHARS.has(ch)) return 11;
    if (ch >= 'A' && ch <= 'Z') return 9;
    return 7; // default lowercase / digit width
}

export function estimatePixelWidth(text: string): number {
    let width = 0;
    for (const ch of text) width += charWidth(ch);
    return width;
}

const SERP_TITLE_MAX_PX = 580;

// Truncates at a word boundary so it never ends mid-word, then appends an
// ellipsis (kept out of the width budget on purpose — Google adds its own
// ellipsis on further truncation regardless, so we're not fighting that).
export function truncateTitleForSerp(title: string, maxPx: number = SERP_TITLE_MAX_PX): string {
    if (estimatePixelWidth(title) <= maxPx) return title;
    const words = title.split(' ');
    let out = '';
    for (const word of words) {
        const candidate = out ? `${out} ${word}` : word;
        if (estimatePixelWidth(candidate) > maxPx) break;
        out = candidate;
    }
    return out ? `${out}…` : title.slice(0, 60);
}

const DESCRIPTION_MAX_CHARS = 158;

// Meta descriptions truncate on character count at a word boundary — SERP
// description width varies too much by device/locale to be worth pixel
// modelling; 155-160 chars is Google's well-established practical cutoff.
export function truncateDescription(text: string, maxChars: number = DESCRIPTION_MAX_CHARS): string {
    const clean = text.replace(/\s+/g, ' ').trim();
    if (clean.length <= maxChars) return clean;
    const slice = clean.slice(0, maxChars);
    const lastSpace = slice.lastIndexOf(' ');
    return `${(lastSpace > 40 ? slice.slice(0, lastSpace) : slice).trim()}…`;
}

// Builds the rich "{Role} at {Company} | {Type} | {Location}" job title,
// pixel-truncated, matching FresherFlow's job-detail <title> format.
export function buildJobTitle(params: {
    title: string;
    company: string;
    type?: string;
    location?: string;
    isRemote?: boolean;
}): string {
    const segments = [`${params.title} at ${params.company}`];
    if (params.type) {
        segments.push(params.type === 'internship' ? 'Internship' : params.type === 'contract' ? 'Contract' : 'Job');
    }
    if (params.isRemote) {
        segments.push('Remote');
    } else if (params.location) {
        segments.push(params.location.split(',')[0].trim());
    }
    const full = segments.join(' | ');
    return truncateTitleForSerp(full);
}

// A job counts as stale for indexing purposes once its deadline (or, when
// no deadline was scraped, 45 days past posted_at — matching the
// validThrough fallback in structuredData.ts's jobPostingSchema()) has
// passed. Google explicitly recommends noindex-ing expired JobPosting
// pages rather than deleting them outright (broken links, lost
// backlinks) — this mirrors FresherFlow's 45-day grace-period noindex in
// opportunitySeo.ts. Shared across every job-detail route
// (jobs/internships/remote-jobs/government-jobs [slug] pages) rather than
// duplicated per-route so the grace period only ever needs updating once.
export function isStaleForIndexing(job: { deadline?: string; posted_at?: string }): boolean {
    const expiry = job.deadline
        ? new Date(job.deadline).getTime()
        : job.posted_at
            ? new Date(job.posted_at).getTime() + 45 * 24 * 60 * 60 * 1000
            : null;
    return expiry !== null && !Number.isNaN(expiry) && expiry < Date.now();
}

// A job counts as low-value for indexing purposes while it's both flagged
// is_thin (crawler/src/processors/quality.py's description-length
// heuristic) and hasn't yet received a real AI overview. This is the same
// condition sitemap-jobs.xml uses to drop a job from the sitemap entirely
// — noindex-ing the page itself too means Google isn't relying solely on
// the sitemap omission (it can still discover the URL via internal links).
// Clears automatically the moment enrichment backfills enriched_overview,
// same as isStaleForIndexing clears once a deadline resolves.
export function isThinAndUnenriched(job: { is_thin?: boolean; enriched_overview?: string }): boolean {
    return job.is_thin === true && !job.enriched_overview;
}

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

// app/layout.tsx wraps every page <title> in `title.template = '%s | InternFlow'`, AFTER the page
// has built its own title. A page that fills the whole 580px budget therefore ends up ~83px over
// it in the SERP and Google cuts the end off (the location, then the brand). Pass
// SERP_TITLE_PX_WITH_BRAND as `maxPx` to reserve room for the suffix. tests/internships-seo.test.ts
// fails if the layout template and this constant drift apart.
export const BRAND_TITLE_SUFFIX = ' | InternFlow';
export const SERP_TITLE_PX_WITH_BRAND = SERP_TITLE_MAX_PX - estimatePixelWidth(BRAND_TITLE_SUFFIX);

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
    /** Pixel budget; defaults to the full SERP width. Use SERP_TITLE_PX_WITH_BRAND when the layout appends the brand. */
    maxPx?: number;
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
    return truncateTitleForSerp(full, params.maxPx);
}

// A job counts as stale for indexing purposes once its deadline (or, when
// no deadline was scraped, 45 days past posted_at) has passed. This is
// independent of the JobPosting schema: jobPostingSchema() only emits
// validThrough for a real scraped deadline and never invents one. Google explicitly recommends noindex-ing expired JobPosting
// pages rather than deleting them outright (broken links, lost
// backlinks) — this mirrors FresherFlow's 45-day grace-period noindex in
// opportunitySeo.ts. Shared across every job-detail route
// (jobs/internships/remote-jobs/government-jobs [slug] pages) rather than
// duplicated per-route so the grace period only ever needs updating once.
const DAY_MS = 24 * 60 * 60 * 1000;
// Jobs that never got a posted_at (the scraper had no date) used to be immortal: no expiry was
// computable, so they stayed indexable forever. created_at is the fallback clock, with a longer
// 60-day window than the 45 days used for a real posted_at because created_at is only "when we first
// saw it". Keep this in sync with STALE_GRACE_DAYS / STALE_NO_POSTED_DAYS in
// services/api/src/services/sitemap_builder.py.
export const STALE_GRACE_DAYS = 45;
export const STALE_NO_POSTED_DAYS = 60;

export function isStaleForIndexing(job: { deadline?: string; posted_at?: string; created_at?: string }): boolean {
    let expiry: number | null = null;
    if (job.deadline) {
        expiry = new Date(job.deadline).getTime();
    } else if (job.posted_at) {
        expiry = new Date(job.posted_at).getTime() + STALE_GRACE_DAYS * DAY_MS;
    } else if (job.created_at) {
        expiry = new Date(job.created_at).getTime() + STALE_NO_POSTED_DAYS * DAY_MS;
    }
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

// SINGLE predicate for "should this job URL be indexed?". Used by BOTH the
// job-detail pages (robots noindex in generateMetadata) and the jobs
// sitemap, so a URL can never be submitted in the sitemap while its own
// page tells Google `noindex` (a conflicting signal that counts against
// sitemap quality). Change the rule here and both sides follow.
export function isIndexableJob(job: {
    deadline?: string;
    posted_at?: string;
    created_at?: string;
    is_thin?: boolean;
    enriched_overview?: string;
}): boolean {
    return !isStaleForIndexing(job) && !isThinAndUnenriched(job);
}

// Government notices are searched as "<department> <post> recruitment 2026" and judged by vacancy count and last
// date, not by "{role} at {company} | Job". Builds that title (department first, "Recruitment {year}", then the
// post and vacancies), pixel-truncated like buildJobTitle. The year comes from the deadline (the year the
// recruitment closes), else posted_at / created_at, so the title never invents a year.
export function buildGovernmentTitle(params: {
    title: string;
    department?: string | null;
    vacancies?: string | null;
    deadline?: string | null;
    posted_at?: string | null;
    created_at?: string | null;
    maxPx?: number;
}): string {
    const yearSource = [params.deadline, params.posted_at, params.created_at].find((v) => v && !Number.isNaN(new Date(v).getTime()));
    const year = yearSource ? new Date(yearSource).getUTCFullYear() : null;
    const dept = (params.department || '').trim();
    const post = params.title.trim();
    const vac = (params.vacancies || '').toString().trim();
    const vacPart = /^\d[\d,]*$/.test(vac) ? ` (${vac} Posts)` : '';
    const lead = dept && !post.toLowerCase().includes(dept.toLowerCase()) ? `${dept} ${post}` : post;
    const full = `${lead} Recruitment${year ? ` ${year}` : ''}${vacPart}`;
    return truncateTitleForSerp(full, params.maxPx);
}

// "Last date: 30 Oct 2026" in a fixed format (no locale lookup, so server and browser agree).
export function formatLastDate(deadline?: string | null): string | null {
    if (!deadline) return null;
    const d = new Date(deadline);
    if (Number.isNaN(d.getTime())) return null;
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

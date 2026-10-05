// Module: lib/footerHiring.ts
// Pure helpers behind the sitewide footer "Hiring now" block (app/components/FooterHiring.tsx).
// Kept free of fetching so they can be unit-tested (tests/footer-hiring.test.ts).
//
// Every link the footer emits sits on EVERY page, so each one must point at a URL that is itself
// indexable and canonical -- otherwise the footer would push crawl budget into noindex pages or
// redirects on the whole site at once:
//   - companies: only those with enough live jobs to pass the company-hub gate (COMPANY_MIN_JOBS)
//   - jobs: only jobs that pass isIndexableJob(), the same predicate the job pages and sitemap use
//   - job hrefs: canonicalPathForJob(), so /jobs/{slug} never redirects to /internships/{slug}

import type { Company } from './companies';
import { companySlug } from './companies';
import type { Job } from './jobs';
import { sortIndiaFirst } from './jobPriority';
import { COMPANY_MIN_JOBS } from './seo/hubThresholds';
import { isIndexableJob } from './seo/seoMetrics';
import { canonicalPathForJob } from './slug';

// Sitewide links dilute each other, so keep the block small enough to read as a curated list.
export const FOOTER_COMPANY_MAX = 30;
export const FOOTER_JOB_MAX = 8;
const TITLE_MAX_CHARS = 60;

function postedTime(value?: string): number {
    if (!value)
        return 0;
    const t = new Date(value).getTime();
    return Number.isNaN(t) ? 0 : t;
}

// Companies to list under "Hiring now": indexable hubs only, most recently posting first. Startups
// only fill whatever room the top / mass-hire companies leave, so recognisable names lead the list.
export function pickHiringCompanies(all: Company[], max = FOOTER_COMPANY_MAX): Company[] {
    const seen = new Set<string>();
    const eligible = all.filter((c) => {
        const slug = companySlug(c.company);
        if (!slug || seen.has(slug) || c.job_count < COMPANY_MIN_JOBS)
            return false;
        seen.add(slug);
        return true;
    });
    const rank = (c: Company) => (c.tier === 'startup' ? 1 : 0);
    return eligible
        .sort((a, b) => rank(a) - rank(b) ||
        postedTime(b.last_posted_at) - postedTime(a.last_posted_at) ||
        b.job_count - a.job_count ||
        a.company.localeCompare(b.company))
        .slice(0, max);
}

// Fresh jobs for the footer: newest first (the API returns them sorted by recency), top companies
// before the rest, India before remote/abroad (same bucket order as the list pages), and at most one
// job per company so the row shows breadth instead of one employer's whole backlog.
export function pickFreshJobs(jobs: Job[], max = FOOTER_JOB_MAX): Job[] {
    const usable = jobs.filter((j) => j.id && j.title?.trim() && j.company?.trim() && !j.is_stale && isIndexableJob(j));
    const ordered = sortIndiaFirst(usable);
    const topFirst = [...ordered.filter((j) => j.is_top_company), ...ordered.filter((j) => !j.is_top_company)];
    const seen = new Set<string>();
    const out: Job[] = [];
    for (const job of topFirst) {
        const key = companySlug(job.company);
        if (seen.has(key))
            continue;
        seen.add(key);
        out.push(job);
        if (out.length >= max)
            break;
    }
    return out;
}

// Anchor text for a job link: descriptive ("Role at Company") rather than a bare URL or "click here".
export function jobAnchorText(job: Pick<Job, 'title' | 'company'>): string {
    const title = job.title.replace(/\s+/g, ' ').trim();
    const short = title.length > TITLE_MAX_CHARS ? `${title.slice(0, TITLE_MAX_CHARS - 1).replace(/\s+\S*$/, '').trimEnd()}…` : title;
    return `${short} at ${job.company.replace(/\s+/g, ' ').trim()}`;
}

export function jobHref(job: Job): string {
    return canonicalPathForJob(job);
}

export function companyHref(company: Pick<Company, 'company'>): string {
    return `/companies/${companySlug(company.company)}`;
}

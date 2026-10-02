// Module: lib/companyLinks.ts
// Pure helpers behind the internal-link blocks that tie job pages, internship pages and company pages together.
// Kept free of fetching so they can be unit-tested (tests/company-links.test.ts).

import type { Job } from './jobs';
import type { Company } from './companies';

// Other live listings at the same company, split into roles and internships, never including the page's own job.
export function pickCompanyLinks(jobs: Job[], internships: Job[], currentId: string, max = 5): { roles: Job[]; internships: Job[] } {
    const seen = new Set<string>([currentId]);
    const take = (list: Job[]): Job[] => {
        const out: Job[] = [];
        for (const job of list) {
            if (seen.has(job.id))
                continue;
            seen.add(job.id);
            out.push(job);
            if (out.length >= max)
                break;
        }
        return out;
    };
    // Internships first so an internship page always gets its sibling internships, even when the
    // ranked list is full of full-time roles.
    const ints = take(internships.filter((j) => j.type === 'internship'));
    const roles = take(jobs.filter((j) => j.type !== 'internship'));
    return { roles, internships: ints };
}

// Companies to cross-link from a company page. Only companies with at least 2 live jobs, so every link
// points at a page that is indexable (thin company pages are noindex and are left out of the sitemap).
export function relatedCompanies(all: Company[], current: Company, max = 8): Company[] {
    const MIN_JOBS = 2;
    const others = all.filter((c) => c.company !== current.company && c.job_count >= MIN_JOBS);
    const byJobs = (a: Company, b: Company) => b.job_count - a.job_count;
    const sameTier = others.filter((c) => c.tier === current.tier).sort(byJobs);
    const otherTier = others.filter((c) => c.tier !== current.tier).sort(byJobs);
    return [...sameTier, ...otherTier].slice(0, max);
}

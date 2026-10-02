// Module: lib/hubLinks.ts
// Pure helpers for the cross-link blocks on list hubs (remote, Japan, Europe), city hubs, batch hubs and
// resume guides, plus the job-page -> hub matching. No fetching, so tests/hub-links.test.ts can run it directly.

import { RESUME_ROLES, type ResumeRoleDefinition } from '../app/resume-for/data';
import { CAREERS, type CareerDefinition } from '../app/careers/data';

export interface SectionLink {
    href: string;
    label: string;
}

// The six listing sections. Every hub shows the other five, so no list page is a dead end.
export const SECTION_LINKS: SectionLink[] = [
    { href: '/jobs', label: 'All jobs' },
    { href: '/internships', label: 'Internships' },
    { href: '/remote-jobs', label: 'Remote jobs' },
    { href: '/government-jobs', label: 'Government jobs' },
    { href: '/japan-jobs', label: 'Japan jobs' },
    { href: '/europe-jobs', label: 'Europe jobs' },
];

export function sectionLinksExcluding(currentHref?: string): SectionLink[] {
    return SECTION_LINKS.filter((s) => s.href !== currentHref);
}

// Companies with the most listings in a set of jobs. Ties go to flagged top companies, then name, so the
// order is stable between builds.
export function topCompaniesFromJobs(jobs: { company: string; is_top_company?: boolean }[], max = 8): { name: string; count: number }[] {
    const counts = new Map<string, { name: string; count: number; top: boolean }>();
    for (const job of jobs) {
        const name = (job.company || '').trim();
        if (!name)
            continue;
        const key = name.toLowerCase();
        const entry = counts.get(key) ?? { name, count: 0, top: false };
        entry.count += 1;
        entry.top = entry.top || Boolean(job.is_top_company);
        counts.set(key, entry);
    }
    return Array.from(counts.values())
        .sort((a, b) => b.count - a.count || Number(b.top) - Number(a.top) || a.name.localeCompare(b.name))
        .slice(0, max)
        .map(({ name, count }) => ({ name, count }));
}

function titleHas(title: string, term: string): boolean {
    return ` ${title.toLowerCase().replace(/[^a-z0-9+#]+/g, ' ')} `.includes(` ${term.toLowerCase()} `);
}

// A resume guide is linked from a job page only when the title really names that role.
export function matchResumeRole(title: string): ResumeRoleDefinition | undefined {
    return RESUME_ROLES.find((r) => titleHas(title, r.searchTerm));
}

export function matchCareer(title: string): CareerDefinition | undefined {
    return CAREERS.find((c) => titleHas(title, c.searchTerm));
}

// Japan and Europe have only list pages, so their job pages are the only inbound path for those lists.
export function regionHubForJob(job: { country?: string }): SectionLink | undefined {
    const country = (job.country || '').trim().toLowerCase();
    if (country === 'japan')
        return { href: '/japan-jobs', label: 'Japan Jobs' };
    if (country === 'europe')
        return { href: '/europe-jobs', label: 'Europe Jobs' };
    return undefined;
}

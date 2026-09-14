// Module: app/components/ExploreRelated.tsx
// Defines component(s)/export(s): ExploreRelated
//
// PHASE 1 thin-content fix — FresherFlow's job detail pages never end on
// just the description; a row of "Explore Related Placements" chip-links
// (company careers / jobs in that city / skill hub / role search) sits
// under the structured details panel, which does two things at once:
//   1. Gives a thin/short-description posting a floor of genuinely useful,
//      non-duplicated content instead of ending abruptly after a few
//      bullet points.
//   2. Internal links into the already-indexed /companies, /jobs-in, and
//      /skills hub pages, which is exactly the kind of contextual linking
//      those hub pages need to rank and to pass equity back to individual
//      job postings.
// This component intentionally only links to hubs that actually match —
// it does not fabricate a location/skill hub link when there's no genuine
// match, since a dead-end or mismatched link is worse for thin-content
// purposes than no link at all.

import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { companySlug } from '@/lib/companies';
import { getCityForLocation } from '@/app/jobs-in/data';
import { SKILLS } from '@/app/skills/data';

const ROLE_LABELS: Record<string, string> = {
    software: 'Software Engineer',
    sales: 'Sales',
    finance: 'Finance',
    other: 'Other',
};

function matchSkillSlug(keyword: string): string | null {
    const normalized = keyword.trim().toLowerCase();
    const found = SKILLS.find(
        (s) =>
            s.name.toLowerCase() === normalized ||
            s.searchTerm.toLowerCase() === normalized ||
            s.slug === normalized.replace(/[^a-z0-9]+/g, '-'),
    );
    return found ? found.slug : null;
}

interface RelatedLink {
    href: string;
    label: string;
    icon: 'company' | 'location' | 'tag' | 'role';
}

export default function ExploreRelated({ job, basePath = '/jobs' }: { job: Job; basePath?: string }) {
    const links: RelatedLink[] = [];

    links.push({
        href: `/companies/${companySlug(job.company)}`,
        label: `${job.company} Careers`,
        icon: 'company',
    });

    const city = getCityForLocation(job.location);
    if (city) {
        links.push({ href: `/jobs-in/${city.slug}`, label: `Jobs in ${city.name}`, icon: 'location' });
    }

    // Up to two skill hub links, matched against the structured
    // required_skills list first (higher precision), falling back to
    // enriched_keywords for jobs that haven't been through structured
    // enrichment yet.
    const candidateSkills = job.required_skills?.length ? job.required_skills : job.enriched_keywords ?? [];
    const seenSkillSlugs = new Set<string>();
    for (const kw of candidateSkills) {
        if (links.length >= 6) break;
        const slug = matchSkillSlug(kw);
        if (!slug || seenSkillSlugs.has(slug)) continue;
        seenSkillSlugs.add(slug);
        const skillDef = SKILLS.find((s) => s.slug === slug);
        links.push({ href: `/skills/${slug}`, label: `${skillDef?.name ?? kw} Jobs`, icon: 'tag' });
        if (seenSkillSlugs.size >= 2) break;
    }

    if (job.job_group && ROLE_LABELS[job.job_group]) {
        links.push({
            href: `${basePath}?role=${job.job_group}`,
            label: `${ROLE_LABELS[job.job_group]} Jobs`,
            icon: 'role',
        });
    }

    if (links.length === 0) return null;

    return (
        <section className="mt-8 border-t pt-6" style={{ borderColor: 'var(--line)' }}>
            <h2 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                Explore Related Placements
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
                {links.map((link) => (
                    <Link
                        key={link.href + link.label}
                        href={link.href}
                        className="chip chip-muted text-[0.7rem] hover:underline touch-manipulation"
                    >
                        <RelatedIcon kind={link.icon} />
                        {link.label}
                    </Link>
                ))}
            </div>
        </section>
    );
}

function RelatedIcon({ kind }: { kind: RelatedLink['icon'] }) {
    const paths: Record<RelatedLink['icon'], string> = {
        company: 'M4 21V7l8-4 8 4v14M9 21v-6h6v6',
        location: 'M12 21s7-6.5 7-12a7 7 0 10-14 0c0 5.5 7 12 7 12z M12 11.5a2 2 0 100-4 2 2 0 000 4z',
        tag: 'M20.59 13.41 11 3.83A2 2 0 009.59 3.24L4 3v5.59a2 2 0 00.59 1.41l9.59 9.59a2 2 0 002.82 0l3.59-3.59a2 2 0 000-2.82z M7 7.01l.01-.011',
        role: 'M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2 M9 11a4 4 0 100-8 4 4 0 000 8z M22 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75',
    };
    return (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden className="opacity-70">
            <path d={paths[kind]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}

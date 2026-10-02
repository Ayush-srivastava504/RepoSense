// Module: app/components/HubExplore.tsx
// Shared "Explore more" link block for list hubs (remote / Japan / Europe), city hubs, batch hubs and
// resume guides. Plain crawlable links only; every group is optional so each page shows what fits it.
// Targets come from the curated data files (CITIES, BATCHES, RESUME_ROLES, SKILLS), so no link can 404.
import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { companySlug } from '@/lib/companies';
import { sectionLinksExcluding, topCompaniesFromJobs } from '@/lib/hubLinks';
import { CITIES } from '@/app/jobs-in/data';
import { BATCHES } from '@/app/batch/data';
import { RESUME_ROLES } from '@/app/resume-for/data';
import { getSkillBySlug } from '@/app/skills/data';

interface Props {
    /** Href of the page this block sits on, so it is left out of the section links. */
    currentSection?: string;
    /** Jobs on the hub, used to pick the companies hiring. Omit to hide the companies group. */
    jobs?: Job[];
    companiesTitle?: string;
    cities?: boolean;
    skipCitySlugs?: string[];
    batches?: boolean;
    skipBatchYears?: string[];
    resumeGuides?: boolean;
    skillSlugs?: string[];
    skillsTitle?: string;
}

function LinkGroup({ title, children }: { title: string; children: React.ReactNode }) {
    return (<div>
      <h3 className="text-sm font-medium">{title}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">{children}</ul>
    </div>);
}

function Chip({ href, children }: { href: string; children: React.ReactNode }) {
    return (<li>
      <Link href={href} className="chip chip-muted text-xs hover:underline touch-manipulation">{children}</Link>
    </li>);
}

export default function HubExplore({ currentSection, jobs, companiesTitle = 'Companies hiring', cities = true, skipCitySlugs = [], batches = true, skipBatchYears = [], resumeGuides = true, skillSlugs = [], skillsTitle = 'Skills to list' }: Props) {
    const companies = jobs ? topCompaniesFromJobs(jobs, 10) : [];
    const sections = sectionLinksExcluding(currentSection);
    const cityLinks = cities ? CITIES.filter((c) => !skipCitySlugs.includes(c.slug)) : [];
    const batchLinks = batches ? BATCHES.filter((b) => !skipBatchYears.includes(b.year)) : [];
    const skills = skillSlugs.map((s) => getSkillBySlug(s)).filter((s) => Boolean(s));
    return (<section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--line)' }} aria-labelledby="explore-more-heading">
      <h2 id="explore-more-heading" className="display text-xl font-medium">Explore more</h2>
      <div className="mt-4 space-y-5">
        {companies.length > 0 && (<LinkGroup title={companiesTitle}>
            {companies.map((c) => (<Chip key={c.name} href={`/companies/${companySlug(c.name)}`}>
                {c.name} ({c.count})
              </Chip>))}
          </LinkGroup>)}
        {sections.length > 0 && (<LinkGroup title="Browse by type">
            {sections.map((s) => (<Chip key={s.href} href={s.href}>{s.label}</Chip>))}
          </LinkGroup>)}
        {cityLinks.length > 0 && (<LinkGroup title="Jobs by city">
            {cityLinks.map((c) => (<Chip key={c.slug} href={`/jobs-in/${c.slug}`}>Jobs in {c.name}</Chip>))}
          </LinkGroup>)}
        {batchLinks.length > 0 && (<LinkGroup title="Jobs by passout batch">
            {batchLinks.map((b) => (<Chip key={b.year} href={`/batch/${b.year}`}>{b.year} batch</Chip>))}
          </LinkGroup>)}
        {skills.length > 0 && (<LinkGroup title={skillsTitle}>
            {skills.map((s) => (<Chip key={s!.slug} href={`/skills/${s!.slug}`}>{s!.name} jobs</Chip>))}
          </LinkGroup>)}
        {resumeGuides && (<LinkGroup title="Resume guides">
            {RESUME_ROLES.map((r) => (<Chip key={r.slug} href={`/resume-for/${r.slug}`}>{r.name} resume</Chip>))}
          </LinkGroup>)}
      </div>
    </section>);
}

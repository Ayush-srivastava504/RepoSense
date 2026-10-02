// Module: app/components/CompanyMoreJobs.tsx
// "More at <company>" block on every job / internship page. Plain text links (not cards) to the same
// company's other roles and internships, plus the company hub. This is the link path that lets
// Google reach sibling listings and passes weight company page <-> job pages in both directions.
import Link from 'next/link';
import type { Job } from '@/lib/jobs';
import { getJobs, getJobsPage } from '@/lib/jobs';
import { companySlug } from '@/lib/companies';
import { pickCompanyLinks } from '@/lib/companyLinks';
import { canonicalPathForJob } from '@/lib/slug';

function JobLinkList({ jobs }: { jobs: Job[] }) {
    return (<ul className="mt-2 space-y-1.5 text-sm">
      {jobs.map((j) => (<li key={j.id}>
          <Link href={canonicalPathForJob(j)} className="underline-offset-2 hover:underline">
            {j.title}
          </Link>
          {j.location && <span style={{ color: 'var(--ink-soft)' }}> · {j.location}</span>}
        </li>))}
    </ul>);
}

export default async function CompanyMoreJobs({ job }: { job: Job }) {
    const [{ jobs, total }, internships] = await Promise.all([
        getJobsPage({ company: job.company, limit: 10, sort: 'ranked' }),
        getJobs({ company: job.company, type: 'internship', limit: 8, sort: 'ranked' }),
    ]);
    const { roles, internships: ints } = pickCompanyLinks(jobs, internships, job.id, 5);
    if (roles.length === 0 && ints.length === 0)
        return null;
    const hub = `/companies/${companySlug(job.company)}`;
    return (<section id="more-at-company" className="mt-8">
      <h2 className="display text-lg font-medium">More at {job.company}</h2>
      {roles.length > 0 && (<>
          <h3 className="mt-3 text-sm font-medium">Other jobs at {job.company}</h3>
          <JobLinkList jobs={roles}/>
        </>)}
      {ints.length > 0 && (<>
          <h3 className="mt-4 text-sm font-medium">Internships at {job.company}</h3>
          <JobLinkList jobs={ints}/>
        </>)}
      <p className="mt-3 text-sm">
        <Link href={hub} className="underline">See all {total > 0 ? total : ''} openings at {job.company}</Link>
      </p>
    </section>);
}

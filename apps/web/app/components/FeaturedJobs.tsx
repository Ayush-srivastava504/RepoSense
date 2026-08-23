// Module: app/components/FeaturedJobs.tsx
// Defines component(s)/export(s): FeaturedJobs
//
//

import type { Job } from '@/lib/jobs';
import JobCard from './JobCard';
export default function FeaturedJobs({ jobs, basePath = '/jobs' }: {
    jobs: Job[];
    basePath?: string;
}) {
    if (jobs.length === 0)
        return null;
    return (<section className="mt-8 mb-10 rounded-[var(--radius-lg)] p-5 sm:p-7" style={{
            border: '1px solid var(--indigo)',
            background: 'var(--indigo-soft)',
        }}>
      <p className="eyebrow eyebrow-accent">// featured opportunities</p>
      <h2 className="display mt-1 text-xl font-medium">High-quality picks right now</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={basePath}/>))}
      </div>
    </section>);
}

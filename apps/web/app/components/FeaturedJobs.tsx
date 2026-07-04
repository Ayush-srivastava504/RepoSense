import type { Job } from '@/lib/jobs';
import JobCard from './JobCard';

/**
 * Renders nothing when `jobs` is empty. Featured jobs always come from the
 * real /api/jobs/featured query (see lib/jobs.ts) - this component never
 * fabricates placeholder listings.
 */
export default function FeaturedJobs({ jobs, basePath = '/jobs' }: { jobs: Job[]; basePath?: string }) {
  if (jobs.length === 0) return null;

  return (
    <section className="mt-10">
      <p className="eyebrow eyebrow-accent">// featured opportunities</p>
      <h2 className="display mt-1 text-xl font-medium">High-quality picks right now</h2>

      <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} basePath={basePath} />
        ))}
      </div>

      <hr className="hr-line mt-10" />
    </section>
  );
}

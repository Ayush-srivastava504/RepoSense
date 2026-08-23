// Module: app/components/SimilarJobs.tsx
// Defines component(s)/export(s): SimilarJobs
//
//

import type { Job } from '@/lib/jobs';
import { canonicalCategoryForJob } from '@/lib/slug';
import JobCard from './JobCard';
export default function SimilarJobs({ jobs }: {
    jobs: Job[];
}) {
    if (jobs.length === 0)
        return null;
    return (<section className="mt-10">
      <hr className="hr-line mb-8"/>
      <p className="eyebrow eyebrow-accent">// similar opportunities</p>
      <h2 className="display mt-1 text-xl font-medium">You might also like</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {jobs.map((job) => (<JobCard key={job.id} job={job} basePath={`/${canonicalCategoryForJob(job)}`}/>))}
      </div>
    </section>);
}

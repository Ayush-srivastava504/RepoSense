// Module: lib/jobPriority.ts
// Defines function(s): bucket, isIndiaJob, sortIndiaFirst
//
//

import type { Job } from './jobs';
function bucket(job: Job): number {
    const country = job.country?.trim().toLowerCase();
    if (!country || country === 'india')
        return 0;
    if (job.is_remote)
        return 1;
    if (country === 'japan')
        return 2;
    return 3;
}
export function isIndiaJob(job: Job): boolean {
    return bucket(job) === 0;
}
export function sortIndiaFirst(jobs: Job[]): Job[] {
    return jobs
        .map((job, index) => ({ job, index }))
        .sort((a, b) => {
        const diff = bucket(a.job) - bucket(b.job);
        return diff !== 0 ? diff : a.index - b.index;
    })
        .map(({ job }) => job);
}

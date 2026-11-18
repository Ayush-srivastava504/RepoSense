// Module: lib/wfhHub.ts
// /remote-jobs is the "Work from home jobs in India" hub. After the India-only switch (migration 039)
// only a handful of remote roles are active at a time, and a list page with three jobs is exactly the
// thin page that keeps a site out of the index. So the hub stays crawlable for users but is noindexed
// AND left out of the sitemap until it has WFH_MIN_INDEXABLE live jobs -- one rule, used by both, so
// the page signal and the sitemap never contradict each other.
import { getJobsPage } from '@/lib/jobs';

export const WFH_MIN_INDEXABLE = 15;

export const WFH_HUB_QUERY = {
    category: 'remote' as const,
    excludeGovernment: true,
    excludeType: 'internship' as const,
};

/** Live WFH job count; 0 on API failure (fails closed: noindex is the safe side). */
export async function wfhJobCount(): Promise<number> {
    const { total } = await getJobsPage({ ...WFH_HUB_QUERY, limit: 1, offset: 0 });
    return total;
}

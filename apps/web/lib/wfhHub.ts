// Module: lib/wfhHub.ts
// /remote-jobs is the "Work from home jobs in India" hub. After the India-only switch (migration 039)
// only a handful of remote roles are active at a time, and a list page with three jobs is exactly the
// thin page that keeps a site out of the index. The hub is always indexable and linked, but it is left
// out of the sitemap until it has WFH_MIN_INDEXABLE live jobs. Pages are never noindexed.
import { getJobsPage } from '@/lib/jobs';

export const WFH_MIN_INDEXABLE = 15;

export const WFH_HUB_QUERY = {
    category: 'remote' as const,
    excludeGovernment: true,
    excludeType: 'internship' as const,
};

/** Live WFH job count; 0 on API failure (fails closed: the hub just stays out of the sitemap). */
export async function wfhJobCount(): Promise<number> {
    const { total } = await getJobsPage({ ...WFH_HUB_QUERY, limit: 1, offset: 0 });
    return total;
}

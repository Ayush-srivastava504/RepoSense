// Module: lib/seo/ogImage.ts
// Defines function(s): jobOgImageUrl
//
// PHASE_PLAN.md Phase 3 item 3 — every job-detail route was falling back to
// the single static /og-image.png for openGraph/twitter images (none of
// jobs/internships/remote-jobs/government-jobs [slug] set openGraph at all,
// so it inherited the root layout's generic default). This is the one
// place that builds a job's OG image URL, so all four routes stay
// consistent with app/og/[filename]/route.tsx's `{id}.png` URL shape.

import { BASE_URL, type Job } from '../jobs';

export function jobOgImageUrl(job: Pick<Job, 'id'>): string {
    return `${BASE_URL}/og/${job.id}.png`;
}

export function jobSlug(job: { id: string; title: string; company: string }): string {
  const base = `${job.title}-${job.company}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return `${base}-${job.id}`;
}

export function jobIdFromSlug(slug: string): string {
  return slug.split('-').pop() ?? '';
}

/**
 * A job can legitimately satisfy more than one category (e.g. a remote
 * government internship), but it must have exactly ONE canonical URL or
 * Google sees conflicting signals. This priority order is the single
 * source of truth for that decision — every detail page and the sitemap
 * import it instead of hardcoding their own path, so they can't drift
 * out of sync with each other again.
 *
 * Priority: government > internship > remote > generic job.
 * Adjust the order here if you want a different category to win ties.
 */
export function canonicalCategoryForJob(job: {
  type?: string;
  is_remote?: boolean;
  is_government?: boolean;
}): 'government-jobs' | 'internships' | 'remote-jobs' | 'jobs' {
  if (job.is_government) return 'government-jobs';
  if (job.type === 'internship') return 'internships';
  if (job.is_remote) return 'remote-jobs';
  return 'jobs';
}

/**
 * The one true URL path for a job, e.g. `/internships/some-role-abc123`.
 * Always rebuilds the slug from the job's current title/company rather
 * than trusting the incoming URL param, so the canonical stays correct
 * even if a title changed since the URL was first indexed.
 */
export function canonicalPathForJob(job: {
  id: string;
  title: string;
  company: string;
  type?: string;
  is_remote?: boolean;
  is_government?: boolean;
}): string {
  return `/${canonicalCategoryForJob(job)}/${jobSlug(job)}`;
}
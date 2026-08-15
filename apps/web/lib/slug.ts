function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/**
 * Builds a descriptive, SEO-friendly slug: title, company, city, and pay
 * all readable in the URL itself — e.g.
 * `/jobs/software-engineer-fullstack-postman-bengaluru-12-23-lpa-3f9a1b2c...`
 * instead of just `/jobs/software-engineer-fullstack-postman-3f9a1b2c...`.
 *
 * Only the trailing job.id segment is load-bearing (see jobIdFromSlug
 * below) — everything before it is purely for readability and SEO, so
 * it's safe to omit fields that are missing or to have this text drift
 * from what's currently in the DB (the canonical <link> on the detail
 * page always points at the freshest slug; see canonicalPathForJob).
 *
 * job.id itself is a 16-char hex hash (see make_job_id in the crawler)
 * with no dashes in it, so taking the LAST '-' segment on the way back
 * out (jobIdFromSlug) is reliable no matter how many descriptive
 * segments precede it.
 */
export function jobSlug(job: {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  stipend?: string;
}): string {
  const parts = [slugify(job.title), slugify(job.company)];

  // City only, not the full "City, State, Country" string — keeps the
  // slug readable instead of ballooning with every location segment.
  const city = job.location?.split(',')[0]?.trim();
  if (city) {
    parts.push(slugify(city));
  }

  const pay = job.salary || job.stipend;
  if (pay) {
    parts.push(slugify(pay));
  }

  const base = parts.filter(Boolean).join('-');

  // Cap the descriptive portion so a verbose salary string ("₹12-23 LPA
  // based on experience and interview performance") can't produce an
  // unreasonably long URL. The id is always appended after this, so
  // truncating here never touches it.
  const MAX_BASE_LENGTH = 90;
  const truncatedBase =
    base.length > MAX_BASE_LENGTH
      ? base.slice(0, MAX_BASE_LENGTH).replace(/-+$/, '')
      : base;

  return `${truncatedBase}-${job.id}`;
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
 * The one true URL path for a job, e.g.
 * `/internships/some-role-acme-pune-15k-mo-abc123`.
 * Always rebuilds the slug from the job's current title/company/
 * location/pay rather than trusting the incoming URL param, so the
 * canonical stays correct even if any of those changed since the URL
 * was first indexed.
 */
export function canonicalPathForJob(job: {
  id: string;
  title: string;
  company: string;
  location?: string;
  salary?: string;
  stipend?: string;
  type?: string;
  is_remote?: boolean;
  is_government?: boolean;
}): string {
  return `/${canonicalCategoryForJob(job)}/${jobSlug(job)}`;
}

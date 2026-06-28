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
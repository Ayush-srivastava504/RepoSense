import type { Job } from '@/lib/jobs';

/**
 * Renders badges from server-computed flags only. No client-side
 * recomputation of "is this fresh / verified / hot" — the API is the
 * single source of truth so the badge logic can't drift from the ranking
 * logic that already uses the same signals.
 */
export default function JobBadges({ job, className = '' }: { job: Job; className?: string }) {
  const badges: { label: string; variant: 'green' | 'rust' | 'muted' | 'indigo' }[] = [];

  if (job.is_top_company) badges.push({ label: 'Top Company', variant: 'indigo' });
  if (job.is_new) badges.push({ label: 'New', variant: 'green' });
  if (job.is_hot) badges.push({ label: 'Hot', variant: 'rust' });
  if (job.is_verified_source) badges.push({ label: 'Verified Source', variant: 'muted' });
  if (job.is_government) badges.push({ label: 'Government', variant: 'indigo' });
  if (job.is_stale) badges.push({ label: 'Listing 30+ days old', variant: 'muted' });

  if (badges.length === 0) return null;

  const variantClass: Record<string, string> = {
    green: 'chip-green',
    rust: 'chip-rust',
    muted: 'chip-muted',
    indigo: 'chip-indigo',
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b) => (
        <span
          key={b.label}
          className={`chip text-[0.65rem] ${variantClass[b.variant] || 'chip-muted'}`}
        >
          {b.label}
        </span>
      ))}
    </div>
  );
}

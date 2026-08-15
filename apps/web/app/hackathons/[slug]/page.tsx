import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { getHackathonBySlug, formatDeadline, BASE_URL } from '@/lib/hackathons';
import HackathonApplyButton from '@/app/components/HackathonApplyButton';
import TrackView from '@/app/components/TrackView';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const hackathon = await getHackathonBySlug(slug);

  if (!hackathon) return {};

  return {
    title: `${hackathon.title} — Hackathon | InternFlow`,
    description:
      hackathon.description?.substring(0, 155) ||
      `${hackathon.title} — registration details, prizes, and how to apply.`,
    alternates: {
      canonical: `${BASE_URL}/hackathons/${slug}`,
    },
  };
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-center justify-between border-b py-3 text-sm" style={{ borderColor: 'var(--line)' }}>
      <span style={{ color: 'var(--ink-soft)' }}>{label}</span>
      <span style={{ color: 'var(--ink)' }}>{value}</span>
    </div>
  );
}

export default async function HackathonDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const hackathon = await getHackathonBySlug(slug);

  if (!hackathon) notFound();

  const teamSize =
    hackathon.team_size_min && hackathon.team_size_max
      ? `${hackathon.team_size_min}–${hackathon.team_size_max} members`
      : undefined;

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <TrackView event="hackathon_viewed" params={{ slug: hackathon.slug, source: hackathon.source }} />
      <p className="eyebrow">{hackathon.organizer || 'Hackathon'}</p>
      <h1 className="display mt-1 text-3xl font-medium" style={{ color: 'var(--ink)' }}>
        {hackathon.title}
      </h1>

      <div className="mt-3 flex flex-wrap gap-2">
        {hackathon.participation_mode && (
          <span className="chip chip-muted text-[11px] uppercase">{hackathon.participation_mode}</span>
        )}
        {hackathon.is_global ? (
          <span className="chip chip-muted text-[11px]">Global</span>
        ) : hackathon.country ? (
          <span className="chip chip-muted text-[11px]">{hackathon.country}</span>
        ) : null}
        <span className="chip chip-muted text-[11px] capitalize">
          {hackathon.status?.replace('_', ' ')}
        </span>
      </div>

      <section className="panel mt-8 p-5">
        <InfoRow label="Registration deadline" value={formatDeadline(hackathon.registration_deadline)} />
        <InfoRow
          label="Starts"
          value={hackathon.start_date ? new Date(hackathon.start_date).toLocaleDateString() : undefined}
        />
        <InfoRow
          label="Ends"
          value={hackathon.end_date ? new Date(hackathon.end_date).toLocaleDateString() : undefined}
        />
        <InfoRow label="Prize pool" value={hackathon.prize_pool_text} />
        <InfoRow label="Team size" value={teamSize} />
      </section>

      {hackathon.description && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            About
          </h2>
          <p className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {hackathon.description}
          </p>
        </section>
      )}

      {hackathon.eligibility && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Who can participate?
          </h2>
          <p className="text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {hackathon.eligibility}
          </p>
        </section>
      )}

      {hackathon.themes && hackathon.themes.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Themes
          </h2>
          <div className="flex flex-wrap gap-2">
            {hackathon.themes.map((theme) => (
              <span key={theme} className="chip chip-muted text-[11px]">
                {theme}
              </span>
            ))}
          </div>
        </section>
      )}

      {hackathon.submission_requirements && hackathon.submission_requirements.length > 0 && (
        <section className="mt-8">
          <h2 className="mb-2 text-sm font-medium uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
            Submission requirements
          </h2>
          <ul className="list-disc pl-5 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
            {hackathon.submission_requirements.map((req) => (
              <li key={req}>{req}</li>
            ))}
          </ul>
        </section>
      )}

      {hackathon.apply_url && (
        <HackathonApplyButton
          url={hackathon.apply_url}
          source={hackathon.source}
          mode={hackathon.participation_mode}
        />
      )}

      <p className="mt-4 text-xs" style={{ color: 'var(--ink-soft)' }}>
        InternFlow is a discovery platform — registration happens on the organizer&apos;s official
        site, not here.
      </p>
    </main>
  );
}

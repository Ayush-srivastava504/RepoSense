import Link from 'next/link';
import type { Hackathon } from '@/lib/hackathons';
import { formatDeadline, daysUntil } from '@/lib/hackathons';

export default function HackathonCard({ hackathon }: { hackathon: Hackathon }) {
  const days = daysUntil(hackathon.registration_deadline);
  const urgent = days !== null && days >= 0 && days <= 3;

  return (
    <Link
      href={`/hackathons/${hackathon.slug}`}
      className="panel flex h-full flex-col p-5 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="eyebrow">
          {hackathon.organizer || 'Hackathon'}
          {hackathon.is_global ? ' · Global' : hackathon.country ? ` · ${hackathon.country}` : ''}
        </p>

        {hackathon.participation_mode && (
          <span className="chip chip-muted text-[11px] uppercase">
            {hackathon.participation_mode}
          </span>
        )}
      </div>

      <h2 className="display mt-3 text-lg font-medium leading-snug" style={{ color: 'var(--ink)' }}>
        {hackathon.title}
      </h2>

      <p className="mt-3 flex-1 text-sm leading-7" style={{ color: 'var(--ink-soft)' }}>
        {hackathon.description
          ? `${hackathon.description.substring(0, 160)}...`
          : 'No description available.'}
      </p>

      {hackathon.themes && hackathon.themes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {hackathon.themes.slice(0, 3).map((theme) => (
            <span key={theme} className="chip chip-muted text-[11px]">
              {theme}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm" style={{ borderColor: 'var(--line)' }}>
        {hackathon.prize_pool_text ? (
          <span style={{ color: 'var(--ink)' }}>{hackathon.prize_pool_text}</span>
        ) : (
          <span style={{ color: 'var(--ink-soft)' }}>Prize TBA</span>
        )}

        <span
          className={urgent ? 'font-medium' : ''}
          style={{ color: urgent ? 'var(--accent, #d64545)' : 'var(--ink-soft)' }}
        >
          {formatDeadline(hackathon.registration_deadline)}
        </span>
      </div>
    </Link>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

import {
  getHackathons,
  getHackathonsEndingSoon,
  BASE_URL,
} from '@/lib/hackathons';
import HackathonCard from '@/app/components/HackathonCard';
import TrackView from '@/app/components/TrackView';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Hackathons — Active Hackathons Worth Building For',
  description:
    'A short, daily-refreshed list of the best active hackathons — online, India, and global. Curated for quality, not volume.',
  alternates: {
    canonical: `${BASE_URL}/hackathons`,
  },
};

const FILTERS = [
  {
    label: 'All',
    mode: undefined,
    country: undefined,
    global: undefined,
  },
  {
    label: 'Online',
    mode: 'online',
    country: undefined,
    global: undefined,
  },
  {
    label: 'India',
    mode: undefined,
    country: 'India',
    global: undefined,
  },
  {
    label: 'Global',
    mode: undefined,
    country: undefined,
    global: 'true',
  },
];

export default async function HackathonsPage({
  searchParams,
}: {
  searchParams: Promise<{
    mode?: string;
    country?: string;
    theme?: string;
    global?: string;
  }>;
}) {
  const params = await searchParams;

  const [hackathons, endingSoon] = await Promise.all([
    getHackathons({
      mode: params.mode,
      country: params.country,
      theme: params.theme,
      isGlobal: params.global === 'true' ? true : undefined,
      limit: 20,
    }),
    getHackathonsEndingSoon(5),
  ]);

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: hackathons.map((hackathon, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      url: `${BASE_URL}/hackathons/${hackathon.slug}`,
    })),
  };

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Hackathons', url: `${BASE_URL}/hackathons` },
  ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }}
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <TrackView
        event="hackathon_page_viewed"
        params={{
          result_count: hackathons.length,
        }}
      />

      <header className="mb-10">
        <p className="eyebrow">Discover</p>

        <h1
          className="display text-3xl font-medium"
          style={{ color: 'var(--ink)' }}
        >
          Find your next hackathon
        </h1>

        <p
          className="mt-2 max-w-2xl text-sm leading-7"
          style={{ color: 'var(--ink-soft)' }}
        >
          Build. Compete. Ship something. We crawl hackathon listings every
          day and keep only the best {hackathons.length || 20} active ones —
          no stale or duplicate events.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          {FILTERS.map((filter) => {
            const qs = new URLSearchParams();

            if (filter.mode) {
              qs.set('mode', filter.mode);
            }

            if (filter.country) {
              qs.set('country', filter.country);
            }

            if (filter.global) {
              qs.set('global', filter.global);
            }

            const href = qs.toString()
              ? `/hackathons?${qs.toString()}`
              : '/hackathons';

            const active =
              (filter.mode ?? '') === (params.mode ?? '') &&
              (filter.country ?? '') === (params.country ?? '') &&
              (filter.global ?? '') === (params.global ?? '');

            return (
              <Link
                key={filter.label}
                href={href}
                className={
                  active
                    ? 'chip chip-active text-sm'
                    : 'chip chip-muted text-sm'
                }
              >
                {filter.label}
              </Link>
            );
          })}
        </div>
      </header>

      {endingSoon.length > 0 && (
        <section className="mb-10">
          <h2
            className="mb-3 text-sm font-medium uppercase tracking-wide"
            style={{ color: 'var(--ink-soft)' }}
          >
            Ending soon
          </h2>

          <div className="flex flex-col gap-2">
            {endingSoon.map((hackathon) => (
              <Link
                key={hackathon.id}
                href={`/hackathons/${hackathon.slug}`}
                className="panel flex items-center justify-between px-4 py-3 text-sm transition hover:-translate-y-0.5"
              >
                <span style={{ color: 'var(--ink)' }}>
                  {hackathon.title}
                </span>

                <span style={{ color: 'var(--ink-soft)' }}>
                  {hackathon.registration_deadline
                    ? new Date(
                        hackathon.registration_deadline
                      ).toLocaleDateString()
                    : 'Deadline TBA'}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2
          className="mb-4 text-sm font-medium uppercase tracking-wide"
          style={{ color: 'var(--ink-soft)' }}
        >
          Active hackathons
        </h2>

        {hackathons.length === 0 ? (
          <p
            className="text-sm"
            style={{ color: 'var(--ink-soft)' }}
          >
            No active hackathons match this filter right now — check back
            soon, the crawler refreshes this list daily.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {hackathons.map((hackathon) => (
              <HackathonCard
                key={hackathon.id}
                hackathon={hackathon}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
import type { Metadata } from 'next';

import { getCompanies } from '@/lib/companies';
import { BASE_URL } from '@/lib/jobs';
import CompanyCard from '@/app/components/CompanyCard';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Companies Hiring — Top, Mass-Hiring & Startups',
  description:
    'Every company with an active listing on InternFlow, grouped into Top Companies, companies mass-hiring right now, and startups. Refreshed daily.',
  alternates: {
    canonical: `${BASE_URL}/companies`,
  },
};

function Section({
  id,
  eyebrow,
  title,
  description,
  companies,
  total,
  accent,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  companies: { company: string; job_count: number; apply_domain?: string; sample_location?: string; last_posted_at?: string; tier: 'top' | 'mass_hire' | 'startup' }[];
  total: number;
  accent: string;
}) {
  if (companies.length === 0) return null;

  return (
    <section id={id} className="py-8 sm:py-10">
      <hr className="hr-line mb-6 sm:mb-8" />

      <div className="mb-5 sm:mb-6 px-0.5">
        <p className="eyebrow text-xs sm:text-sm" style={{ color: accent }}>
          // {eyebrow}
        </p>
        <h2 className="display mt-1 text-xl sm:text-2xl font-medium">{title}</h2>
        <p className="mt-1.5 max-w-2xl text-xs sm:text-sm" style={{ color: 'var(--ink-soft)' }}>
          {description}
        </p>
      </div>

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {companies.map((c) => (
          <CompanyCard key={c.company} company={c} />
        ))}
      </div>

      {total > companies.length && (
        <p className="mt-5 text-xs sm:text-sm px-0.5" style={{ color: 'var(--muted)' }}>
          Showing {companies.length} of {total} companies.
        </p>
      )}
    </section>
  );
}

export default async function CompaniesPage() {
  const { top, mass_hire, startup, mass_hire_threshold } = await getCompanies();

  const totalCompanies = top.total + mass_hire.total + startup.total;

  const breadcrumb = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Companies', url: `${BASE_URL}/companies` },
  ]);

  return (
    <main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }}
      />

      <header>
        <p className="eyebrow eyebrow-accent mb-2 text-xs sm:text-sm">// companies hiring</p>
        <h1 className="display text-2xl sm:text-3xl font-medium">
          {totalCompanies > 0
            ? `${totalCompanies} companies currently hiring`
            : 'Companies currently hiring'}
        </h1>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Every company below has at least one active listing right now — pulled straight from
          the same feed as our Jobs and Internships pages. Grouped into three tiers so you can
          jump to whichever kind of company you're targeting.
        </p>

        {totalCompanies > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {top.companies.length > 0 && (
              <a href="#top" className="chip chip-indigo text-xs touch-manipulation">
                Top Companies ({top.total})
              </a>
            )}
            {mass_hire.companies.length > 0 && (
              <a href="#mass-hire" className="chip chip-green text-xs touch-manipulation">
                Mass Hiring ({mass_hire.total})
              </a>
            )}
            {startup.companies.length > 0 && (
              <a href="#startups" className="chip chip-rust text-xs touch-manipulation">
                Startups ({startup.total})
              </a>
            )}
          </div>
        )}
      </header>

      <Section
        id="top"
        eyebrow="top companies"
        title="Top Companies"
        description="Established names — big tech, IT services, BFSI, and well-known consumer brands — actively hiring right now."
        companies={top.companies}
        total={top.total}
        accent="var(--indigo)"
      />

      <Section
        id="mass-hire"
        eyebrow="mass hiring"
        title="Mass Hiring"
        description={`Companies currently running ${mass_hire_threshold}+ open listings at once — a genuine hiring drive, not a single opening.`}
        companies={mass_hire.companies}
        total={mass_hire.total}
        accent="var(--green)"
      />

      <Section
        id="startups"
        eyebrow="startups"
        title="Startups"
        description="Smaller and newer companies with an active listing — a mix of early-stage startups and niche employers."
        companies={startup.companies}
        total={startup.total}
        accent="var(--rust)"
      />

      {totalCompanies === 0 && (
        <p className="mt-10 text-sm" style={{ color: 'var(--muted)' }}>
          No companies with active listings right now — check back after the next crawl.
        </p>
      )}
    </main>
  );
}

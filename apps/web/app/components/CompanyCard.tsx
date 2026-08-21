import Link from 'next/link';
import type { Company } from '@/lib/companies';
import { timeAgo } from '@/lib/timeAgo';
import CompanyLogo from './CompanyLogo';

export default function CompanyCard({ company }: { company: Company }) {
  return (
    <Link
      href={`/jobs?search=${encodeURIComponent(company.company)}`}
      className="panel group flex items-center gap-3 p-4 transition-all hover:-translate-y-1 hover:shadow-lg"
    >
      <CompanyLogo
        company={company.company}
        logoDomain={company.logo_domain}
        size={44}
      />

      <div className="min-w-0 flex-1">
        <h3
          className="display truncate text-base font-medium"
          style={{ color: 'var(--ink)' }}
        >
          {company.company}
        </h3>

        <p className="mt-0.5 text-xs" style={{ color: 'var(--ink-soft)' }}>
          {company.job_count} open listing{company.job_count === 1 ? '' : 's'}
          {company.sample_location ? ` · ${company.sample_location}` : ''}
        </p>
      </div>

      {company.last_posted_at && (
        <span
          className="hidden flex-none text-[11px] sm:block"
          style={{ color: 'var(--muted)' }}
        >
          {timeAgo(company.last_posted_at)}
        </span>
      )}
    </Link>
  );
}

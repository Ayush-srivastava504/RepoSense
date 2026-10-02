// Module: app/components/JobCompanyAbout.tsx
// "About <company>" on a job page, from the company's own crawled pages (services/company_intel overview topic,
// grounded and source-linked). Renders nothing when no overview exists for the company.
import Link from 'next/link';
import type { CompanyIntel } from '@/lib/companies';
import { companySlug } from '@/lib/companies';

export default function JobCompanyAbout({ company, intel }: { company: string; intel: CompanyIntel | null }) {
    const overview = intel?.topics.find((t) => t.topic_key === 'overview');
    if (!overview)
        return null;
    return (<section id="about-company" className="mt-8">
      <h2 className="display text-lg font-medium">About {company}</h2>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink)' }}>{overview.body}</p>
      <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Link href={`/companies/${companySlug(company)}`} className="underline">All jobs and hiring details at {company}</Link>
        {intel?.official_domain && (<a href={`https://${intel.official_domain}`} rel="nofollow noopener" target="_blank" className="underline">{intel.official_domain}</a>)}
      </p>
    </section>);
}

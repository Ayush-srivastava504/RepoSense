// Module: app/components/RelatedCompanies.tsx
// "Other companies hiring" block on company pages: company -> company links so no hub is a dead end.
import Link from 'next/link';
import type { Company } from '@/lib/companies';
import { companySlug } from '@/lib/companies';

export default function RelatedCompanies({ companies }: { companies: Company[] }) {
    if (companies.length === 0)
        return null;
    return (<section className="mt-10">
      <h2 className="display text-xl font-medium">Other companies hiring</h2>
      <ul className="mt-4 flex flex-wrap gap-2">
        {companies.map((c) => (<li key={c.company}>
            <Link href={`/companies/${companySlug(c.company)}`} className="chip chip-muted text-xs hover:underline">
              {c.company} jobs &amp; internships ({c.job_count})
            </Link>
          </li>))}
      </ul>
    </section>);
}

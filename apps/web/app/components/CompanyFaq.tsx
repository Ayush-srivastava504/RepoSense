// Module: app/components/CompanyFaq.tsx
// Questions and answers the company published on its own FAQ page (lifted verbatim by services/company_intel),
// each with a link back to that page. The FAQPage JSON-LD in app/companies/[company]/page.tsx is built from
// exactly these pairs, so markup and visible content always match.
import type { CompanyFaq as Faq } from '@/lib/companies';

function host(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    }
    catch {
        return url;
    }
}

export default function CompanyFaq({ faq }: { faq: Faq[] }) {
    if (faq.length === 0)
        return null;
    const source = faq[0].source_url;
    return (<section id="company-faq" className="panel mt-8 p-5 text-sm">
      <h2 className="display text-lg font-medium">Frequently asked questions</h2>
      <dl className="mt-3 space-y-4">
        {faq.map((f) => (<div key={f.question}>
            <dt className="font-medium">{f.question}</dt>
            <dd className="mt-1 leading-relaxed" style={{ color: 'var(--ink)' }}>{f.answer}</dd>
          </div>))}
      </dl>
      <p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
        Published by the company at <a href={source} rel="nofollow noopener" target="_blank" className="underline">{host(source)}</a>.
      </p>
    </section>);
}

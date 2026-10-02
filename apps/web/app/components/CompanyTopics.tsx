// Module: app/components/CompanyTopics.tsx
// Renders the crawled + AI-enriched topic sections for a company. Each section was written only from the
// company's own pages (services/company_intel); the source links are shown so readers can check them.
import type { CompanyTopic } from '@/lib/companies';

function host(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    }
    catch {
        return url;
    }
}

export default function CompanyTopics({ topics }: { topics: CompanyTopic[] }) {
    if (topics.length === 0)
        return null;
    return (<div className="mt-8 space-y-6">
      {topics.map((t) => (<section key={t.topic_key} id={t.topic_key} className="panel p-5 text-sm">
          <h2 className="display text-lg font-medium">{t.title}</h2>
          <p className="mt-2 leading-relaxed" style={{ color: 'var(--ink)' }}>{t.body}</p>
          {t.bullets.length > 0 && (<ul className="mt-3 list-disc space-y-1 pl-5" style={{ color: 'var(--ink)' }}>
              {t.bullets.map((b) => (<li key={b}>{b}</li>))}
            </ul>)}
          {t.source_urls.length > 0 && (<p className="mt-3 text-xs" style={{ color: 'var(--muted)' }}>
              Source: {t.source_urls.map((u, i) => (<span key={u}>{i > 0 ? ', ' : ''}<a href={u} rel="nofollow noopener" target="_blank" className="underline">{host(u)}</a></span>))}
            </p>)}
        </section>))}
    </div>);
}

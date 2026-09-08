// Module: app/components/Breadcrumbs.tsx
// Defines component(s)/export(s): Breadcrumbs
//
// Visible breadcrumb trail. Pass the same { name, url } items already being
// built for lib/structuredData's breadcrumbSchema() so the on-page trail and
// the BreadcrumbList JSON-LD always agree — mismatched breadcrumbs are a
// common reason Google declines to show the rich snippet.

import Link from 'next/link';

export interface BreadcrumbItem {
    name: string;
    url: string;
}

// A BreadcrumbList JSON-LD object, as returned by lib/structuredData's
// breadcrumbSchema(). Accepting this directly (rather than a separate items
// array) means the visible trail always matches the schema already being
// emitted for search engines — one source of truth, no drift.
interface BreadcrumbListSchema {
    itemListElement: {
        name: string;
        item: string;
    }[];
}

export default function Breadcrumbs({ items, schema, className = '', }: {
    items?: BreadcrumbItem[];
    schema?: BreadcrumbListSchema;
    className?: string;
}) {
    const resolved: BreadcrumbItem[] = items
        ?? schema?.itemListElement.map((entry) => ({ name: entry.name, url: entry.item }))
        ?? [];
    if (resolved.length < 2) {
        return null;
    }
    return (<nav aria-label="Breadcrumb" className={`mb-4 ${className}`}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs sm:text-sm" style={{ color: 'var(--muted)' }}>
        {resolved.map((item, index) => {
            const isLast = index === resolved.length - 1;
            return (<li key={item.url} className="flex items-center gap-1.5">
              {index > 0 && (<span aria-hidden="true" style={{ color: 'var(--line-strong)' }}>
                /
              </span>)}
              {isLast
                    ? (<span aria-current="page" style={{ color: 'var(--ink)' }}>
                  {item.name}
                </span>)
                    : (<Link href={item.url.replace(/^https?:\/\/[^/]+/, '') || '/'} className="transition-colors hover:underline" style={{ color: 'var(--muted)' }}>
                  {item.name}
                </Link>)}
            </li>);
        })}
      </ol>
    </nav>);
}

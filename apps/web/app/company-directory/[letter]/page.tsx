// Module: app/company-directory/[letter]/page.tsx
// A-Z company directory. Every company (live listings or enough published topics) appears on exactly one
// letter page, so no company is reachable only through the sitemap. Paginated at DIRECTORY_PAGE_SIZE.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BASE_URL } from '@/lib/jobs';
import { DIRECTORY_PAGE_SIZE, companySlug, directoryLabel, getCompanyDirectory } from '@/lib/companies';
import CompanyCard from '@/app/components/CompanyCard';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import { breadcrumbSchema, itemListSchema, languageAlternates, safeJsonLd } from '@/lib/structuredData';

export const revalidate = 3600;

const LETTER_RE = /^(?:[a-z]|0-9|other)$/;

function parsePage(raw?: string): number {
    return Math.max(1, Number.parseInt(raw ?? '1', 10) || 1);
}

export async function generateMetadata({ params, searchParams }: {
    params: { letter: string };
    searchParams: { page?: string };
}): Promise<Metadata> {
    if (!LETTER_RE.test(params.letter))
        return {};
    const page = parsePage(searchParams?.page);
    const label = directoryLabel(params.letter);
    const path = `/company-directory/${params.letter}`;
    const url = `${BASE_URL}${path}${page > 1 ? `?page=${page}` : ''}`;
    const suffix = page > 1 ? ` — Page ${page}` : '';
    const title = `Companies starting with ${label} — Jobs & Internships${suffix}`;
    const description = `Companies starting with ${label} that are hiring or have a company profile on InternFlow. Open each one for live jobs, internships and hiring information.${suffix}`;
    return {
        title,
        description,
        alternates: { canonical: url, languages: page > 1 ? undefined : languageAlternates(path) },
        openGraph: { type: 'website', url, title, description, images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: title }] },
    };
}

export default async function CompanyDirectoryLetterPage({ params, searchParams }: {
    params: { letter: string };
    searchParams: { page?: string };
}) {
    if (!LETTER_RE.test(params.letter))
        notFound();
    const page = parsePage(searchParams?.page);
    const data = await getCompanyDirectory(params.letter, page);
    if (!data || data.total === 0 || data.companies.length === 0)
        notFound();
    const label = directoryLabel(params.letter);
    const totalPages = Math.max(1, Math.ceil(data.total / DIRECTORY_PAGE_SIZE));
    const path = `/company-directory/${params.letter}`;
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Companies', url: `${BASE_URL}/companies` },
        { name: `Companies starting with ${label}`, url: `${BASE_URL}${path}${page > 1 ? `?page=${page}` : ''}` },
    ]);
    const itemList = itemListSchema(`Companies starting with ${label}`,
        data.companies.map((c) => ({ name: c.company, url: `${BASE_URL}/companies/${companySlug(c.company)}` })),
        (page - 1) * DIRECTORY_PAGE_SIZE + 1);
    return (<main className="mx-auto max-w-6xl px-3 sm:px-4 py-8 sm:py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(crumbs) }}/>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(itemList) }}/>
      <Breadcrumbs schema={crumbs}/>
      <header>
        <p className="eyebrow eyebrow-accent mb-2 text-xs sm:text-sm">// company directory</p>
        <h1 className="display text-2xl sm:text-3xl font-medium">Companies starting with {label}</h1>
        <p className="mt-3 max-w-2xl text-xs sm:text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {data.total} {data.total === 1 ? 'company' : 'companies'} hiring now or with a company profile. Open one to see its live jobs and internships.
        </p>
      </header>

      <nav aria-label="Company directory letters" className="mt-5 flex flex-wrap gap-2">
        {data.letters.map((l) => (<Link key={l.letter} href={`/company-directory/${l.letter}`}
            className={`chip text-xs touch-manipulation ${l.letter === params.letter ? 'chip-indigo' : 'chip-muted'}`}
            aria-current={l.letter === params.letter ? 'page' : undefined}>
            {directoryLabel(l.letter)}
          </Link>))}
      </nav>

      <h2 className="sr-only">Companies starting with {label}</h2>
      <div className="mt-8 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {data.companies.map((c) => (<CompanyCard key={c.company} company={c}/>))}
      </div>

      {totalPages > 1 && (<nav className="mt-8 flex flex-wrap justify-center gap-1.5 sm:gap-2" aria-label="Pagination">
          {page > 1 && (<Link href={`${path}${page - 1 > 1 ? `?page=${page - 1}` : ''}`} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Previous page">←</Link>)}
          <span className="flex items-center px-2 text-sm" style={{ color: 'var(--ink-soft)' }}>Page {page} of {totalPages}</span>
          {page < totalPages && (<Link href={`${path}?page=${page + 1}`} className="btn min-w-[44px] px-3 py-2 text-sm touch-manipulation" aria-label="Next page">→</Link>)}
        </nav>)}
    </main>);
}

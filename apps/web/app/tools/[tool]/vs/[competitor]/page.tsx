// Module: app/tools/[tool]/vs/[competitor]/page.tsx
// Defines component(s)/export(s): ToolComparisonPage
// Defines function(s): generateStaticParams, generateMetadata
//
// Programmatic comparison/alternative pages: one entry in
// app/tools/comparisons.ts produces one page here, same
// content-model-as-data-file approach as app/tools/[tool]/page.tsx.

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL } from '@/lib/jobs';
import { getToolBySlug } from '@/app/tools/data';
import { getComparison, getComparisonParams, getComparisonsForTool } from '@/app/tools/comparisons';
import { breadcrumbSchema, faqSchema, languageAlternates } from '@/lib/structuredData';
import TrackView from '@/app/components/TrackView';
import Breadcrumbs from '@/app/components/Breadcrumbs';

export const dynamicParams = false;

export function generateStaticParams() {
    return getComparisonParams();
}

export async function generateMetadata({ params }: {
    params: { tool: string; competitor: string };
}): Promise<Metadata> {
    const comparison = getComparison(params.tool, params.competitor);
    const tool = getToolBySlug(params.tool);
    if (!comparison || !tool) return {};
    const url = `${BASE_URL}/tools/${tool.slug}/vs/${comparison.competitorSlug}`;
    return {
        title: comparison.metaTitle,
        description: comparison.metaDescription,
        alternates: { canonical: url, languages: languageAlternates(`/tools/${tool.slug}/vs/${comparison.competitorSlug}`) },
        openGraph: {
            type: 'website',
            url,
            title: comparison.metaTitle,
            description: comparison.metaDescription,
        },
        twitter: {
            card: 'summary_large_image',
            title: comparison.metaTitle,
            description: comparison.metaDescription,
        },
    };
}

export default function ToolComparisonPage({ params }: {
    params: { tool: string; competitor: string };
}) {
    const comparison = getComparison(params.tool, params.competitor);
    const tool = getToolBySlug(params.tool);
    if (!comparison || !tool) notFound();

    const url = `${BASE_URL}/tools/${tool.slug}/vs/${comparison.competitorSlug}`;
    const otherComparisons = getComparisonsForTool(tool.slug).filter(
        (c) => c.competitorSlug !== comparison.competitorSlug,
    );
    const faqs = faqSchema(comparison.faqs);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Tools', url: `${BASE_URL}/tools` },
        { name: tool.name, url: `${BASE_URL}/tools/${tool.slug}` },
        { name: `vs ${comparison.competitorName}`, url },
    ]);

    return (<main className="w-full">
      <Script id="comparison-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>
      <Script id="comparison-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>
      <TrackView event="tool_comparison_view" params={{ tool: tool.slug, competitor: comparison.competitorSlug }}/>

      <div className="mx-auto w-full max-w-3xl px-3 py-10 sm:px-4 sm:py-14">
        <p className="eyebrow eyebrow-accent">// {tool.category.toLowerCase()} comparison</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          InternFlow vs {comparison.competitorName}
        </h1>
        <p className="mt-3 text-lg" style={{ color: 'var(--ink-soft)' }}>
          {tool.shortName} vs {comparison.competitorName} — which one fits your job search?
        </p>
        <p className="mt-4 leading-relaxed">{comparison.intro}</p>

        <Link href={tool.ctaHref} className="btn btn-primary mt-6 inline-block">
          {tool.ctaLabel}
        </Link>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Feature by feature</h2>
          <div className="mt-4 -mx-3 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[560px] border-collapse text-sm sm:min-w-0">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--line-strong)' }}>
                  <th className="px-3 py-3 text-left font-medium">Feature</th>
                  <th className="px-3 py-3 text-left font-medium">InternFlow</th>
                  <th className="px-3 py-3 text-left font-medium">{comparison.competitorName}</th>
                </tr>
              </thead>
              <tbody>
                {comparison.rows.map((row) => (<tr key={row.feature} className="border-b align-top" style={{ borderColor: 'var(--line)' }}>
                    <td className="px-3 py-3 font-medium whitespace-nowrap">{row.feature}</td>
                    <td className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{row.internflow}</td>
                    <td className="px-3 py-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{row.competitor}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Which should you use?</h2>
          <p className="mt-4 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{comparison.verdict}</p>
        </section>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {comparison.faqs.map((faq) => (<div key={faq.question} className="panel p-4 sm:p-5">
                <p className="font-medium">{faq.question}</p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{faq.answer}</p>
              </div>))}
          </div>
        </section>

        {otherComparisons.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Other comparisons</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {otherComparisons.map((c) => (<li key={c.competitorSlug}>
                  <Link href={`/tools/${tool.slug}/vs/${c.competitorSlug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    vs {c.competitorName}
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Explore more</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            <li>
              <Link href={`/tools/${tool.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                {tool.name} overview
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/tools" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                All free tools
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>);
}

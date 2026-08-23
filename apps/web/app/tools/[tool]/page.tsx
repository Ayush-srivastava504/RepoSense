// Module: app/tools/[tool]/page.tsx
// Defines component(s)/export(s): ToolLandingPage
// Defines function(s): generateStaticParams, generateMetadata
//

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { BASE_URL } from '@/lib/jobs';
import { TOOLS, getToolBySlug, getRelatedTools } from '@/app/tools/data';
import { breadcrumbSchema, faqSchema, howToSchema, softwareApplicationSchema, } from '@/lib/structuredData';
import TrackView from '@/app/components/TrackView';
import { StepGrid, BulletGrid } from '@/app/components/FactGrid';
export const dynamicParams = false;
export function generateStaticParams() {
    return TOOLS.map((tool) => ({ tool: tool.slug }));
}
export async function generateMetadata({ params, }: {
    params: {
        tool: string;
    };
}): Promise<Metadata> {
    const tool = getToolBySlug(params.tool);
    if (!tool)
        return {};
    const url = `${BASE_URL}/tools/${tool.slug}`;
    return {
        title: tool.metaTitle,
        description: tool.metaDescription,
        alternates: { canonical: url },
        openGraph: {
            type: 'website',
            url,
            title: tool.metaTitle,
            description: tool.metaDescription,
            images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: tool.name }],
        },
        twitter: {
            card: 'summary_large_image',
            title: tool.metaTitle,
            description: tool.metaDescription,
            images: [`${BASE_URL}/og-image.png`],
        },
    };
}
export default function ToolLandingPage({ params }: {
    params: {
        tool: string;
    };
}) {
    const tool = getToolBySlug(params.tool);
    if (!tool)
        notFound();
    const url = `${BASE_URL}/tools/${tool.slug}`;
    const related = getRelatedTools(tool);
    const appSchema = softwareApplicationSchema({
        name: tool.name,
        description: tool.metaDescription,
        url,
        category: tool.category,
    });
    const howTo = howToSchema({
        name: `How to use the ${tool.name}`,
        description: tool.heroDescription,
        steps: tool.howItWorks,
    });
    const faqs = faqSchema(tool.faqs);
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Tools', url: `${BASE_URL}/tools` },
        { name: tool.name, url },
    ]);
    return (<main className="w-full">
      <Script id="tool-app-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}/>
      <Script id="tool-howto-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }}/>
      <Script id="tool-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }}/>
      <Script id="tool-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <TrackView event="tool_landing_view" params={{ tool: tool.slug }}/>

      <div className="mx-auto w-full max-w-3xl px-3 py-10 sm:px-4 sm:py-14">
        <nav className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
          <Link href="/">Home</Link> <span aria-hidden="true">/</span>{' '}
          <Link href="/tools">Tools</Link> <span aria-hidden="true">/</span> {tool.name}
        </nav>

        <p className="eyebrow eyebrow-accent">// {tool.category.toLowerCase()}</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{tool.name}</h1>
        <p className="mt-3 text-lg" style={{ color: 'var(--ink-soft)' }}>{tool.tagline}</p>
        <p className="mt-4 leading-relaxed">{tool.heroDescription}</p>

        <Link href={tool.ctaHref} className="btn btn-primary mt-6 inline-block">
          {tool.ctaLabel}
        </Link>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Why students use it</h2>
          <div className="mt-4">
            <BulletGrid items={tool.benefits}/>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">How it works</h2>
          <div className="mt-4">
            <StepGrid steps={tool.howItWorks}/>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="display text-xl font-medium">Frequently asked questions</h2>
          <div className="mt-4 space-y-3">
            {tool.faqs.map((faq) => (<div key={faq.question} className="panel p-4 sm:p-5">
                <p className="font-medium">{faq.question}</p>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{faq.answer}</p>
              </div>))}
          </div>
        </section>

        {related.length > 0 && (<section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
            <h2 className="display text-xl font-medium">Related tools</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((relatedTool) => (<li key={relatedTool.slug}>
                  <Link href={`/tools/${relatedTool.slug}`} className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                    {relatedTool.shortName}
                    <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
                  </Link>
                </li>))}
            </ul>
          </section>)}

        <section className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <h2 className="display text-xl font-medium">Explore more</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            <li>
              <Link href="/jobs" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Browse jobs
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/internships" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Browse internships
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
            <li>
              <Link href="/remote-jobs" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
                Remote jobs
                <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
              </Link>
            </li>
          </ul>
        </section>
      </div>
    </main>);
}

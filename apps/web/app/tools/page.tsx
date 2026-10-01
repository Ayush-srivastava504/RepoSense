// Module: app/tools/page.tsx
// Defines component(s)/export(s): ToolsHubPage
//
// Tools hub: tools grouped by the stage of an application they help with, followed by the
// editorial guide (motto, topics, FAQ with matching schema, related links).

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { BASE_URL } from '@/lib/jobs';
import { TOOLS, getToolBySlug, type ToolDefinition } from '@/app/tools/data';
import { TOOLS_GUIDE, TOOL_GROUPS } from '@/lib/content/toolGuides';
import { breadcrumbSchema, languageAlternates } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import SectionGuide from '@/app/components/SectionGuide';

export const metadata: Metadata = {
    title: 'Free AI Career Tools for Students',
    description:
        'Free career tools for engineering students: resume builder, ATS resume checker, GitHub README generator, LinkedIn optimizer, cover letter generator, job match score, application tracker and auto-apply.',
    alternates: { canonical: `${BASE_URL}/tools`, languages: languageAlternates('/tools') },
};

export default function ToolsHubPage() {
    const crumbs = breadcrumbSchema([
        { name: 'Home', url: BASE_URL },
        { name: 'Tools', url: `${BASE_URL}/tools` },
    ]);

    const grouped = TOOL_GROUPS.map((group) => ({
        ...group,
        tools: group.slugs
            .map((slug) => getToolBySlug(slug))
            .filter((t): t is ToolDefinition => Boolean(t)),
    }));
    // Safety net: a tool added to data.ts but not to a group still shows up.
    const groupedSlugs = new Set(TOOL_GROUPS.flatMap((g) => g.slugs));
    const ungrouped = TOOLS.filter((t) => !groupedSlugs.has(t.slug));

    return (<main className="w-full">
      <Script id="tools-hub-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}/>
      <Breadcrumbs schema={crumbs}/>

      <div className="mx-auto w-full max-w-5xl px-3 py-10 sm:px-4 sm:py-14">
        <p className="eyebrow eyebrow-accent">// ai tools</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          Free AI career tools for students
        </h1>
        <p className="mt-1 text-sm italic" style={{ color: 'var(--indigo)' }}>
          {TOOLS_GUIDE.motto}
        </p>
        <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          Tools for each stage of an application, built for engineering students: from a resume
          that starts with your GitHub projects, to a tracker that remembers what you sent. Not
          sure where to begin? Follow the three stages below, in order.
        </p>

        <nav aria-label="Application stages" className="mt-8 grid gap-3 sm:grid-cols-3">
          {grouped.map((group) => (<a key={group.key} href={`#${group.key}`} className="panel card-lift block p-4">
              <span className="eyebrow eyebrow-accent">{group.step}</span>
              <span className="display mt-1 block text-base font-medium">{group.title}</span>
              <span className="mt-1 block text-xs leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {group.blurb}
              </span>
            </a>))}
        </nav>

        {grouped.map((group) => (<section key={group.key} id={group.key} className="mt-12 scroll-mt-20">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow eyebrow-accent">{group.step}</span>
              <h2 className="display text-xl font-medium sm:text-2xl">{group.title}</h2>
            </div>
            <p className="mt-1 max-w-2xl text-sm" style={{ color: 'var(--ink-soft)' }}>{group.blurb}</p>
            <ToolGrid tools={group.tools}/>
          </section>))}

        {ungrouped.length > 0 && (<section className="mt-12">
            <h2 className="display text-xl font-medium sm:text-2xl">More tools</h2>
            <ToolGrid tools={ungrouped}/>
          </section>)}

        <SectionGuide section="tools"/>
      </div>
    </main>);
}

function ToolGrid({ tools }: { tools: ToolDefinition[] }) {
    return (<div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (<Link key={tool.slug} href={`/tools/${tool.slug}`} className="panel card-lift flex h-full flex-col p-5">
          <p className="eyebrow eyebrow-accent">// {tool.category.toLowerCase()}</p>
          <h3 className="display mt-2 text-lg font-medium">{tool.name}</h3>
          <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{tool.tagline}</p>
          <ul className="mt-3 space-y-1 text-xs" style={{ color: 'var(--ink-soft)' }}>
            {tool.benefits.slice(0, 2).map((benefit) => (<li key={benefit} className="flex gap-2">
                <span aria-hidden="true">·</span>
                <span>{benefit}</span>
              </li>))}
          </ul>
          <span className="mt-auto pt-4 text-sm font-medium underline">See how it works →</span>
        </Link>))}
    </div>);
}

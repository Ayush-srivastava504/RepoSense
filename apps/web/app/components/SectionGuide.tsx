// Module: app/components/SectionGuide.tsx
// Defines component(s)/export(s): SectionGuide
//
// Editorial block shown under the listings on the plain first page of each main section.
// Content lives in lib/content/sectionGuides.ts so every section carries its own copy.
// Render only when the view is page 1 with no filters — deeper and filtered URLs would
// otherwise repeat the same long copy under different URLs.

import Link from 'next/link';
import FAQAccordion from '@/app/components/FAQAccordion';
import { faqSchema } from '@/lib/structuredData';
import { SECTION_GUIDES, type SectionGuideContent } from '@/lib/content/sectionGuides';

// `section` is a plain string on purpose: several pages (companies, tools, careers, batch,
// jobs-in, resume-for, japan-jobs, europe-jobs) already render <SectionGuide> but have no
// guide written yet. Those render nothing instead of failing the build / crashing the page.
// To add one: add the key to SectionKey + SECTION_GUIDES in lib/content/sectionGuides.ts.
export default function SectionGuide({ section }: { section: string }) {
    const guide = (SECTION_GUIDES as Record<string, SectionGuideContent | undefined>)[section];
    if (!guide) {
        return null;
    }
    const schema = faqSchema(guide.faqs);

    return (
        <section className="mt-16 sm:mt-20" aria-labelledby={`${section}-guide-heading`}>
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
            />

            <hr className="hr-line mb-10" />

            <p className="eyebrow eyebrow-accent text-xs sm:text-sm">// the short guide</p>
            <h2
                id={`${section}-guide-heading`}
                className="display mt-2 text-xl sm:text-2xl font-medium"
            >
                {guide.heading}
            </h2>
            <p
                className="mt-3 max-w-3xl text-sm leading-relaxed"
                style={{ color: 'var(--ink-soft)' }}
            >
                {guide.intro}
            </p>

            <div className="mt-8 grid gap-4 sm:gap-5 md:grid-cols-2">
                {guide.topics.map((topic) => (
                    <article key={topic.title} className="panel p-4 sm:p-5">
                        <h3 className="display text-base font-medium">{topic.title}</h3>
                        {topic.body.map((paragraph, i) => (
                            <p
                                key={i}
                                className="mt-2 text-sm leading-relaxed"
                                style={{ color: 'var(--ink-soft)' }}
                            >
                                {paragraph}
                            </p>
                        ))}
                        {topic.link && (
                            <Link
                                href={topic.link.href}
                                className="mt-3 inline-block text-sm underline"
                            >
                                {topic.link.label}
                            </Link>
                        )}
                    </article>
                ))}
            </div>

            <h2 className="display mt-14 text-xl sm:text-2xl font-medium">
                Frequently asked questions
            </h2>
            <div className="mt-5 max-w-3xl">
                <FAQAccordion items={guide.faqs} />
            </div>

            <h2 className="display mt-14 text-lg font-medium">Keep exploring</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {guide.related.map((item) => (
                    <li key={item.href}>
                        <Link href={item.href} className="panel card-lift block p-4">
                            <span className="display text-sm font-medium">{item.label}</span>
                            <span
                                className="mt-1 block text-xs"
                                style={{ color: 'var(--ink-soft)' }}
                            >
                                {item.note}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    );
}

// Module: app/components/EntityNotes.tsx
// Defines component(s)/export(s): EntityNotes
//
// Unique editorial block for a single city / batch / career / resume-role detail page:
// a short written section plus a FAQ whose visible questions and FAQPage JSON-LD come
// from the same list, so the markup always matches what the reader sees.

import FAQAccordion from '@/app/components/FAQAccordion';
import { faqSchema } from '@/lib/structuredData';
import type { EntityNote } from '@/lib/content/entityNotes';

export default function EntityNotes({
    note,
    idPrefix,
}: {
    note: EntityNote | undefined;
    idPrefix: string;
}) {
    if (!note) return null;
    return (
        <section
            className="mt-10 border-t pt-8"
            style={{ borderColor: 'var(--line)' }}
            aria-labelledby={`${idPrefix}-notes-heading`}
        >
            <script
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(note.faqs)) }}
            />
            <h2 id={`${idPrefix}-notes-heading`} className="display text-xl font-medium">
                {note.heading}
            </h2>
            <div
                className="mt-4 max-w-3xl space-y-3 text-sm leading-relaxed sm:text-base"
                style={{ color: 'var(--ink-soft)' }}
            >
                {note.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                ))}
            </div>

            <h3 className="display mt-8 text-lg font-medium">Questions people ask</h3>
            <div className="mt-4 max-w-3xl">
                <FAQAccordion items={note.faqs} />
            </div>
        </section>
    );
}

// Module: app/components/JobFAQ.tsx
// Defines component(s)/export(s): JobFAQ
//
// Renders job.content_faq (crawler/src/processors/content_layer.py's
// build_faq(), computed at crawl time and gated by content_tier — see
// lib/jobs.ts's Job.content_faq comment). Deliberately renders nothing
// for 'table_only' tier jobs (content_faq is [] in that case): a
// low-confidence FAQ answer is worse for trust and SEO than no FAQ
// section at all, so there's no fallback/generic content here to paper
// over that gap.
//
// The matching FAQPage JSON-LD is built by the page (via
// lib/structuredData.ts's faqSchema()) and passed in as `schemaId` purely
// so this component can label the section consistently — the actual
// <script> tag stays at the page level alongside the other schema blocks,
// matching how jobPostingSchema/breadcrumbSchema are already wired in
// app/jobs/[slug]/page.tsx.

import FAQAccordion from '@/app/components/FAQAccordion';
import type { Job } from '@/lib/jobs';

export default function JobFAQ({ job }: { job: Job }) {
    if (!job.content_faq || job.content_faq.length === 0) {
        return null;
    }
    const items = job.content_faq.map((f) => ({ question: f.q, answer: f.a }));
    return (<section className="mt-8">
      <h2 className="display text-lg font-medium">
        Frequently asked questions
      </h2>
      <div className="mt-3">
        <FAQAccordion items={items}/>
      </div>
    </section>);
}

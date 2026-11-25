// Module: app/components/JobArticle.tsx
// The long-form, job-specific guide (jobs.enriched_sections.article, services/api/src/services/job_article_service.py).
// Every paragraph was written for this listing and validated (no invented numbers, no filler, no phrasing shared
// with other published articles). Its FAQs are merged into <JobFAQ/> and the FAQPage schema by lib/jobFaq.ts, so
// they are not repeated here. Renders nothing until the article exists.
import type { Job } from '@/lib/jobs';
import { jobArticle } from '@/lib/jobContent';
import { buildJobFaq } from '@/lib/jobFaq';

export default function JobArticle({ job }: { job: Job }) {
    const article = jobArticle(job);
    if (!article)
        return null;
    return (<div id="guide" className="mt-8">
      <nav aria-label="On this page" className="panel p-4 text-sm">
        <p className="eyebrow">On this page</p>
        <ol className="mt-2 grid gap-1 sm:grid-cols-2">
          {article.sections.map((s) => (<li key={s.key}>
              <a href={`#guide-${s.key}`} className="hover:underline">{s.heading}</a>
            </li>))}
          {buildJobFaq(job).length > 0 && (<li><a href="#faq" className="hover:underline">Frequently asked questions</a></li>)}
        </ol>
      </nav>
      {article.sections.map((s) => (<section key={s.key} id={`guide-${s.key}`} className="mt-8 scroll-mt-20">
          <h2 className="display text-xl font-medium">{s.heading}</h2>
          {s.paragraphs.map((p, i) => (<p key={i} className="mt-3 text-[0.95rem] leading-relaxed" style={{ color: 'var(--ink)' }}>
              {p}
            </p>))}
        </section>))}
    </div>);
}

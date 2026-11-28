import type { Metadata } from 'next';
import Script from 'next/script';
import { BASE_URL } from '@/lib/jobs';
import { breadcrumbSchema, faqSchema, howToSchema, softwareApplicationSchema, languageAlternates } from '@/lib/structuredData';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import AutoApplyDashboard from './AutoApplyDashboard';
import ToolVideoGuide from '@/app/components/ToolVideoGuide';

const PAGE_URL = `${BASE_URL}/auto-apply`;
const TITLE = 'Auto-Apply: Match Your Resume to Jobs and Apply Faster';
const DESCRIPTION = 'Upload your resume once, see the job openings it matches with a score for each, and apply faster. Free for students and freshers.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL, languages: languageAlternates('/auto-apply') },
  openGraph: {
    type: 'website',
    url: PAGE_URL,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: `${BASE_URL}/og-image.png`, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: [`${BASE_URL}/og-image.png`],
  },
};

const HOW_IT_WORKS = [
  { name: '1. Resume Ingestion', text: 'Upload your PDF resume to parse skills, work experience, and contact details automatically.' },
  { name: '2. Multi-ATS Discovery', text: 'Programmatically query active job listings across Greenhouse, Lever, Ashby, and direct ATS boards.' },
  { name: '3. Hybrid Scoring', text: 'Score job relevance using keyword match percentage, title alignment, and skill ontology matching.' },
  { name: '4. Playwright Stealth Automation', text: 'Auto-fill form inputs, upload resumes, and preview submissions with humanized typing and delays.' },
  { name: '5. Application Tracking', text: 'Log every submission in PostgreSQL, prevent double-applying, and track interview pipeline statuses.' },
];

const FAQS = [
  {
    question: 'How does the auto-apply engine prevent getting flagged by anti-bot systems?',
    answer: 'The engine uses Playwright stealth mode with humanized keystroke typing delays (100-250ms), randomized cursor movements, and pauses (1.5-3.5s) per form field.',
  },
  {
    question: 'What is Dry-Run mode?',
    answer: 'Dry-Run mode populates standard candidate inputs on job forms and captures a verification screenshot without clicking the final Submit button, allowing you to preview form inputs before live submission.',
  },
  {
    question: 'Which ATS job boards are supported?',
    answer: 'Direct programmatic form filling and discovery support Greenhouse, Lever, Ashby, BambooHR, Workable, and standard web job forms.',
  },
];

export default function AutoApplyPage() {
  const appSchema = softwareApplicationSchema({
    name: 'InternFlow Auto-Apply',
    description: DESCRIPTION,
    url: PAGE_URL,
    category: 'Career Automation Tools',
  });

  const howTo = howToSchema({
    name: 'How to apply to jobs faster with InternFlow Auto-Apply',
    description: DESCRIPTION,
    steps: HOW_IT_WORKS,
  });

  const faqs = faqSchema(FAQS);
  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Auto-Apply Engine', url: PAGE_URL },
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <Script id="auto-apply-app-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <Script id="auto-apply-howto-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />
      <Script id="auto-apply-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }} />
      <Script id="auto-apply-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      
      <Breadcrumbs schema={crumbs} />

      <div className="space-y-3">
        <p className="eyebrow eyebrow-accent">// automated career pipeline</p>
        <h1 className="display text-3xl font-medium sm:text-4xl">
          Automated Job Application Engine
        </h1>
        <p className="max-w-3xl text-lg text-slate-600 dark:text-slate-400">
          Parse your resume, score multi-board job matches, preview Playwright form filling automation, and track all application statuses in one unified pipeline.
        </p>
      </div>

      <AutoApplyDashboard />

      <ToolVideoGuide slug="auto-apply" className="mt-12"/>

      <section className="mt-12 border-t pt-8 border-slate-200 dark:border-slate-800">
        <h2 className="display text-xl font-medium mb-4">Frequently Asked Questions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          {FAQS.map((faq) => (
            <div key={faq.question} className="panel p-5 space-y-2">
              <h3 className="font-semibold text-sm">{faq.question}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

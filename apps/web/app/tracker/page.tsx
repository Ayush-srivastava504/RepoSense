import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

import { BASE_URL } from '@/lib/jobs';
import {
  breadcrumbSchema,
  faqSchema,
  howToSchema,
  softwareApplicationSchema,
} from '@/lib/structuredData';
import TrackView from '@/app/components/TrackView';
import TrackerBoard from './TrackerBoard';

const PAGE_URL = `${BASE_URL}/tracker`;

const TITLE = 'My Applications — Free Job Application Tracker';
const DESCRIPTION =
  'Track every internship and job application in one free pipeline: Saved, Applied, Interviewing, Offer. Get deadline reminders so you never miss an application window — no account required.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: PAGE_URL },
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
  { name: 'Save a listing', text: 'Tap the bookmark icon on any job or internship card on InternFlow to add it to your tracker.' },
  { name: 'Update its status', text: 'Move it from Saved to Applied, Interviewing, or Offer as your application progresses.' },
  { name: 'Watch your deadlines', text: 'Come back to this page any time to see every upcoming deadline sorted by urgency.' },
];

const FAQS = [
  {
    question: 'Do I need an account to use the job application tracker?',
    answer:
      'No. The tracker works instantly for anyone — it saves your pipeline locally in your browser, so there is nothing to sign up for.',
  },
  {
    question: 'Will I lose my tracked applications if I clear my browser data?',
    answer:
      'Yes, since the tracker is stored locally rather than in an account, clearing your browser storage will reset it — this keeps the feature private and account-free by default.',
  },
  {
    question: 'Can I track internships as well as full-time jobs?',
    answer:
      'Yes, the tracker works the same way for any listing on InternFlow, including internships, remote roles, and government jobs.',
  },
];

export default function TrackerPage() {
  const appSchema = softwareApplicationSchema({
    name: 'InternFlow Job Application Tracker',
    description: DESCRIPTION,
    url: PAGE_URL,
    category: 'Career Tools',
  });

  const howTo = howToSchema({
    name: 'How to track your job applications on InternFlow',
    description: DESCRIPTION,
    steps: HOW_IT_WORKS,
  });

  const faqs = faqSchema(FAQS);

  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'My Applications', url: PAGE_URL },
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:py-10">
      <Script id="tracker-app-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }} />
      <Script id="tracker-howto-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howTo) }} />
      <Script id="tracker-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqs) }} />
      <Script id="tracker-breadcrumb-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <TrackView event="tracker_landing_view" />

      <nav className="mb-6 text-sm" style={{ color: 'var(--ink-soft)' }}>
        <Link href="/">Home</Link> <span aria-hidden="true">/</span> My Applications
      </nav>

      <p className="eyebrow eyebrow-accent">// career tools</p>
      <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
        My Applications
      </h1>
      <p className="mt-3 max-w-2xl text-lg" style={{ color: 'var(--ink-soft)' }}>
        Track every internship and job application in one free pipeline —
        no account required.
      </p>
      <p className="mt-4 max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        Job boards are stateless — you find a listing, leave, and lose track
        of what you saved, what you already applied to, and when a deadline
        is coming up. Save any job or internship from InternFlow in one
        click, move it through Saved → Applied → Interviewing → Offer, and
        get a heads-up on deadlines before it&apos;s too late to apply.
        Everything stays in your own browser, not on a server.
      </p>

      <section className="mt-10">
        <h2 className="display text-xl font-medium">How it works</h2>
        <ol className="mt-4 space-y-4">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.name}>
              <p className="font-medium">{index + 1}. {step.name}</p>
              <p className="mt-1" style={{ color: 'var(--ink-soft)' }}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <TrackerBoard />

      <section className="mt-12 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
        <h2 className="display text-xl font-medium">Frequently asked questions</h2>
        <div className="mt-4 space-y-3">
          {FAQS.map((faq) => (
            <div key={faq.question} className="panel p-4 sm:p-5">
              <p className="font-medium">{faq.question}</p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{faq.answer}</p>
            </div>
          ))}
        </div>
      </section>

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
            <Link href="/tools/job-match-score" className="panel card-lift flex items-center justify-between gap-2 px-4 py-3 text-sm font-medium">
              AI job match score
              <span aria-hidden="true" style={{ color: 'var(--ink-soft)' }}>→</span>
            </Link>
          </li>
        </ul>
      </section>
    </main>
  );
}

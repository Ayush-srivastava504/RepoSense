// Module: app/components/HomeFaq.tsx
// Defines component(s)/export(s): HomeFaq, HOME_FAQS
// Homepage FAQ for Indian fresher job seekers. Renders with native <details>
// (no JS) and emits matching FAQPage JSON-LD.

import { faqSchema } from '@/lib/structuredData';

export const HOME_FAQS: { question: string; answer: string }[] = [
  {
    question: 'Which jobs can a B.Tech or BE graduate apply for as a fresher?',
    answer: 'B.Tech and BE graduates, especially from CSE, IT and ECE, commonly apply for software engineer, backend or full-stack developer, data engineer, AI/ML engineer, DevOps and cloud engineer roles. Many companies also hire freshers through campus drives and off-campus programs, so check the passout batch (for example 2026 or 2027) on each listing before you apply.',
  },
  {
    question: 'Can BCA, B.Sc or MCA students get IT jobs?',
    answer: 'Yes. Many companies hire BCA, B.Sc (Computer Science or IT) and MCA graduates for software developer, web developer, QA, support engineer, data analyst and data engineer roles. Always read the eligibility section of a listing, since some employers specify degrees or minimum percentage and others only ask for skills.',
  },
  {
    question: 'What jobs can an MBA fresher apply for?',
    answer: 'MBA freshers usually look at business analyst, data analyst, marketing, operations, HR and finance roles. Skills such as Excel, SQL and Power BI make an application noticeably stronger for analyst positions.',
  },
  {
    question: 'How do I get a software engineer job as a fresher in India?',
    answer: 'Build two or three solid projects and put them on GitHub, practise data structures and algorithms, keep a one-page ATS-friendly resume, and apply to many openings while tracking each application. Internships are a strong route to a full-time offer, so apply to those alongside full-time roles.',
  },
  {
    question: 'How do I become a data engineer or AI/ML engineer as a fresher?',
    answer: 'For data engineering, learn SQL, Python, and a data processing tool such as Spark, plus one cloud platform (AWS, GCP or Azure), and build a small pipeline project. For AI/ML, learn Python, statistics and a library such as scikit-learn or PyTorch, then build and publish a few end-to-end projects. Many entry-level openings start as data analyst or software engineer roles.',
  },
  {
    question: 'Are internships paid in India, and can they lead to a job?',
    answer: 'Many tech internships in India pay a monthly stipend, though some, especially at very early-stage startups, are unpaid or low-paid. The listing shows stipend details when the employer provides them. Good internships often convert to full-time offers, which is why they are worth applying to in your pre-final and final year.',
  },
  {
    question: 'What is an ATS-friendly resume and why does it matter?',
    answer: 'An ATS (applicant tracking system) is software many companies use to scan and rank resumes before a recruiter reads them. An ATS-friendly resume uses simple formatting, standard section headings and keywords from the job description. InternFlow\'s free ATS checker scores your resume against a specific job description.',
  },
  {
    question: 'Where do the listings on InternFlow come from?',
    answer: 'Listings are collected from company career pages and job boards and refreshed regularly. Each listing links to the original apply page, and we show a confidence label so you can see how well a listing has been verified. Never pay anyone to apply for a job or internship.',
  },
];

export default function HomeFaq() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema(HOME_FAQS)) }} />
      <div className="max-w-3xl divide-y" style={{ borderColor: 'var(--line)' }}>
        {HOME_FAQS.map((f) => (
          <details key={f.question} className="group py-4" style={{ borderColor: 'var(--line)' }}>
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-left text-base font-medium" style={{ color: 'var(--ink)' }}>
              <span>{f.question}</span>
              <span aria-hidden="true" className="mt-0.5 flex-none transition group-open:rotate-45" style={{ color: 'var(--ink-soft)' }}>+</span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{f.answer}</p>
          </details>
        ))}
      </div>
    </>
  );
}

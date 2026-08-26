// Module: app/components/FAQAccordion.tsx
// Defines component(s)/export(s): FAQAccordion
//
//

'use client';

import { useState } from 'react';

interface FAQItem {
  question: string;
  answer: string;
}

const faqData: FAQItem[] = [
  {
    question: 'What is an internship?',
    answer: 'An internship is a short, structured work placement — usually a few weeks to a few months — where a student or recent graduate works on real tasks inside a company to build job-ready skills. Internships can be paid or unpaid, remote or in-office, and often lead to a full-time offer.'
  },
  {
    question: 'How to write a cover letter for an internship?',
    answer: 'Open with the specific role and company, mention one concrete project or skill that matches the internship description, explain briefly why you want that team, and close with a clear call to action. Keep it under a page and avoid repeating your resume line by line. InternFlow\'s cover letter tool generates a first draft from your resume and the job description in seconds.'
  },
  {
    question: 'How to get an internship?',
    answer: 'Build one or two solid projects, keep your GitHub and resume current, apply early to internship listings in your field, and follow up with a short, specific cover letter. Tracking every application with a tool like InternFlow\'s tracker helps you stay on top of deadlines and follow-ups.'
  },
  {
    question: 'What is the highest paying job?',
    answer: 'The highest paying jobs today typically sit in AI engineering, specialised software and data engineering, cloud/DevOps, product management, and finance — especially at senior levels or in high-demand remote roles. Salary depends heavily on experience, company, and location, so it\'s worth comparing listings for AI engineer jobs, data engineer jobs, and DevOps jobs side by side.'
  },
  {
    question: 'What is a cover letter?',
    answer: 'A cover letter is a short, one-page letter sent with your resume that explains who you are, why you want a specific role, and what makes you a fit for it — in your own words rather than a list of bullet points.'
  },
  {
    question: 'What is a remote job?',
    answer: 'A remote job lets you work from home or any location instead of commuting to an office, communicating with your team through calls, chat, and shared documents. Remote roles exist across almost every field, from remote DevOps jobs to remote customer service jobs.'
  },
  {
    question: 'How to get a remote job?',
    answer: 'Search remote-specific job boards, filter listings by "remote" or "work from home," tailor your resume to show you can work independently and communicate asynchronously, and be ready to demonstrate your setup and time-zone availability during interviews.'
  },
  {
    question: 'What is a job?',
    answer: 'A job is a regular position of paid work, typically involving defined responsibilities, working hours, and compensation, whether full-time, part-time, contract, or internship-based.'
  },
  {
    question: 'What jobs hire at 14?',
    answer: 'In most regions the legal minimum working age is 14–16 depending on local labour law, and typical roles at that age are things like retail assistance, babysitting, tutoring, or family-business help — always check your local regulations first.'
  },
  {
    question: 'What jobs hire at 15?',
    answer: 'At 15, common entry points include retail, food service, tutoring, camp counselling, and freelance digital work such as graphic design, again subject to your country\'s minimum working age rules.'
  },
  {
    question: 'What do finance jobs pay?',
    answer: 'Finance salaries vary widely by role and seniority — entry-level analyst roles typically pay less than specialised or senior roles such as investment banking, private equity, or finance leadership, which are among the higher paying jobs in most markets.'
  },
  {
    question: 'What jobs make the most money?',
    answer: 'Roles in AI/ML engineering, specialised data engineering, cloud architecture and DevOps, senior software engineering, and executive or finance leadership positions are consistently among the highest paying jobs, particularly with a few years of experience.'
  },
  {
    question: 'How to find remote jobs?',
    answer: 'Use a job aggregator that tags listings by remote status, set filters for "remote job openings" or "fully remote jobs," and check company career pages directly for remote-first employers. InternFlow\'s remote jobs section aggregates listings from multiple sources daily.'
  },
  {
    question: 'How long does an internship interview take?',
    answer: 'Most internship interviews run 20–45 minutes, sometimes across one or two rounds — a screening call followed by a technical or behavioural round for competitive programs.'
  },
  {
    question: 'How to apply for an internship?',
    answer: 'Shortlist roles that match your skills, tailor your resume and a short cover letter to each, apply through the company portal or a listings site, and track your applications so you can follow up at the right time.'
  },
  {
    question: 'Are internships paid?',
    answer: 'Many internships are paid, especially in tech, engineering, and finance, though some — particularly in smaller companies or certain industries — are unpaid or offer only a stipend. Always check the listing details before applying.'
  },
  {
    question: 'How to make a resume stand out?',
    answer: 'Lead with measurable outcomes instead of duties ("reduced load time by 35%" instead of "worked on performance"), keep formatting clean and ATS-friendly, and tailor keywords to each job description rather than sending one generic resume everywhere.'
  },
  {
    question: 'What is a resume?',
    answer: 'A resume is a concise document — usually one page for students and early-career candidates — summarising your education, skills, projects, and experience for a specific job or internship application.'
  },
  {
    question: 'How long should a resume be?',
    answer: 'For students and early-career applicants, one page is standard. Experienced professionals can extend to two pages if the extra content is genuinely relevant.'
  },
  {
    question: 'How to make a resume for first job?',
    answer: 'Lead with education and any projects, coursework, or internships, add technical and soft skills relevant to the role, and use action verbs with specific outcomes wherever possible, even for academic or personal projects.'
  },
  {
    question: 'How to add a resume to LinkedIn?',
    answer: 'On your LinkedIn profile, go to the "Featured" or "About" section (or Resume upload under "More"), choose "Add media" or "Upload resume," and select your PDF file. Keep your profile summary consistent with the resume you upload.'
  },
  {
    question: 'How to create a resume?',
    answer: 'Start from a clean, ATS-friendly template, list your contact info, education, skills, and experience or projects in reverse-chronological order, and keep formatting simple — a resume builder like InternFlow\'s can generate ATS-ready bullets directly from your GitHub activity.'
  },
  {
    question: 'What is a data engineer?',
    answer: 'A data engineer builds and maintains the pipelines and infrastructure that move, clean, and store data so it can be used for analytics, machine learning, and reporting — distinct from a data analyst, who mostly works with data that\'s already prepared.'
  },
  {
    question: 'How to become a data engineer?',
    answer: 'Learn SQL, Python, and a distributed data framework such as Spark, get comfortable with cloud platforms (AWS, GCP, or Azure), build a portfolio of pipeline projects, and consider a certification such as the AWS Data Engineer certification to validate your skills.'
  },
  {
    question: 'What does a data engineer do?',
    answer: 'A data engineer designs data pipelines, manages databases and warehouses, ensures data quality and reliability, and works closely with data scientists and analysts to make sure the data they need is accurate and accessible.'
  },
  {
    question: 'How much does a data engineer make?',
    answer: 'Data engineer salaries vary by country, company, and seniority, but the role consistently ranks among the higher paying jobs in tech due to strong demand — check current data engineer salary listings on job boards for numbers specific to your market and experience level.'
  },
  {
    question: 'What is ATS?',
    answer: 'ATS stands for Applicant Tracking System — software that companies use to collect, scan, and rank resumes before a human recruiter sees them.'
  },
  {
    question: 'What is ATS friendly resume?',
    answer: 'An ATS-friendly resume uses standard section headings, simple formatting without tables or graphics that confuse parsers, and keywords that match the job description, so the applicant tracking system can read and rank it correctly.'
  },
  {
    question: 'What is an ATS system?',
    answer: 'An ATS system is the software recruiters use to manage job applications — parsing resumes into structured data, filtering by keywords, and tracking each candidate through the hiring pipeline.'
  },
  {
    question: 'What is ATS in recruiting?',
    answer: 'In recruiting, ATS refers to the Applicant Tracking System that automates sorting and screening of incoming applications, which is why formatting your resume to be machine-readable matters as much as the content itself.'
  },
  {
    question: 'How long should a cover letter be?',
    answer: 'A cover letter should generally fit on one page — three to four short paragraphs are enough to introduce yourself, connect your experience to the role, and close with a clear next step.'
  },
  {
    question: 'How to prepare for an interview?',
    answer: 'Research the company and role, review common interview questions for your field, prepare a few STAR-method stories from your experience, and prepare a short list of questions to ask the interviewer at the end.'
  },
  {
    question: 'What to wear to an interview?',
    answer: 'When in doubt, dress slightly more formally than the company\'s everyday dress code — business casual is a safe default for most tech and corporate interviews, while roles in finance or law often expect full formal wear.'
  },
  {
    question: 'What are the 7 most common interview questions and answers?',
    answer: 'Common questions include "Tell me about yourself," "Why do you want this role," "What are your strengths and weaknesses," "Describe a challenge you overcame," "Where do you see yourself in five years," "Why should we hire you," and "Do you have any questions for us" — prepare a short, specific answer for each ahead of time.'
  },
  {
    question: 'What questions to ask at the end of an interview?',
    answer: 'Good questions include what success looks like in the first 90 days, what the team\'s biggest current challenge is, how the role has evolved, and what the next steps in the process are.'
  },
  {
    question: 'How to prepare for a phone interview?',
    answer: 'Keep your resume and notes in front of you, find a quiet space with good signal, speak a little slower and more clearly than usual since there\'s no body language to help, and have a couple of questions ready for the interviewer.'
  },
  {
    question: 'How to use LinkedIn?',
    answer: 'Complete your profile with a clear headline, summary, and experience section, connect with classmates and professionals in your field, follow companies you\'re interested in, and use LinkedIn Jobs to search and apply directly.'
  },
  {
    question: 'What is internship definition?',
    answer: 'By definition, an internship is a temporary, supervised work experience — typically for students or recent graduates — designed to build practical skills and industry exposure rather than long-term employment.'
  },
  {
    question: 'What is the STAR method for interviews?',
    answer: 'STAR stands for Situation, Task, Action, Result — a structure for answering behavioural interview questions by describing the context, your specific responsibility, what you did, and the measurable outcome.'
  }
];

export default function FAQAccordion({ items }: { items?: FAQItem[] } = {}) {
  const data = items && items.length > 0 ? items : faqData;
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFAQ = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <div className="space-y-3">
      {data.map((faq, index) => (
        <div 
          key={index}
          className="panel card-lift overflow-hidden transition-all duration-200"
          style={{ 
            borderColor: openIndex === index ? 'var(--indigo)' : 'var(--line)',
            borderWidth: '1px',
          }}
        >
          <button
            onClick={() => toggleFAQ(index)}
            aria-expanded={openIndex === index}
            className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-[var(--bg-soft)] transition-colors duration-150 sm:p-5"
          >
            <h3 className="display text-sm font-medium pr-2 sm:text-base sm:pr-8">{faq.question}</h3>
            <span 
              className="flex-shrink-0 text-xl font-light transition-transform duration-300 sm:text-2xl"
              style={{ 
                color: 'var(--ink-soft)',
                transform: openIndex === index ? 'rotate(45deg)' : 'rotate(0deg)'
              }}
            >
              +
            </span>
          </button>
          
          <div 
            className="overflow-hidden transition-all duration-300 ease-in-out"
            style={{
              maxHeight: openIndex === index ? '500px' : '0',
              opacity: openIndex === index ? 1 : 0,
            }}
          >
            <div className="px-4 pb-4 sm:px-5 sm:pb-5">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {faq.answer}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
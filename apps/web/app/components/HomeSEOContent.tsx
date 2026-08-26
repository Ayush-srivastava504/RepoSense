// Module: app/components/HomeSEOContent.tsx
// Defines component(s)/export(s): HomeSEOContent
// Long-form on-page SEO content + FAQ section (with FAQPage JSON-LD) for the homepage.
//

import Script from 'next/script';
import Link from 'next/link';
import ScrollReveal from '@/app/components/ScrollReveal';
import { faqSchema } from '@/lib/structuredData';

const faqs: { question: string; answer: string }[] = [
    { question: 'What is an internship?', answer: 'An internship is a short, structured work placement — usually a few weeks to a few months — where a student or recent graduate works on real tasks inside a company to build job-ready skills. Internships can be paid or unpaid, remote or in-office, and often lead to a full-time offer.' },
    { question: 'How to write a cover letter for an internship?', answer: 'Open with the specific role and company, mention one concrete project or skill that matches the internship description, explain briefly why you want that team, and close with a clear call to action. Keep it under a page and avoid repeating your resume line by line. InternFlow\'s cover letter tool generates a first draft from your resume and the job description in seconds.' },
    { question: 'How to get an internship?', answer: 'Build one or two solid projects, keep your GitHub and resume current, apply early to internship listings in your field, and follow up with a short, specific cover letter. Tracking every application with a tool like InternFlow\'s tracker helps you stay on top of deadlines and follow-ups.' },
    { question: 'What is the highest paying job?', answer: 'The highest paying jobs today typically sit in AI engineering, specialised software and data engineering, cloud/DevOps, product management, and finance — especially at senior levels or in high-demand remote roles. Salary depends heavily on experience, company, and location, so it\'s worth comparing listings for AI engineer jobs, data engineer jobs, and DevOps jobs side by side.' },
    { question: 'What is a cover letter?', answer: 'A cover letter is a short, one-page letter sent with your resume that explains who you are, why you want a specific role, and what makes you a fit for it — in your own words rather than a list of bullet points.' },
    { question: 'What is a remote job?', answer: 'A remote job lets you work from home or any location instead of commuting to an office, communicating with your team through calls, chat, and shared documents. Remote roles exist across almost every field, from remote DevOps jobs to remote customer service jobs.' },
    { question: 'How to get a remote job?', answer: 'Search remote-specific job boards, filter listings by "remote" or "work from home," tailor your resume to show you can work independently and communicate asynchronously, and be ready to demonstrate your setup and time-zone availability during interviews.' },
    { question: 'What is a job?', answer: 'A job is a regular position of paid work, typically involving defined responsibilities, working hours, and compensation, whether full-time, part-time, contract, or internship-based.' },
    { question: 'What jobs hire at 14?', answer: 'In most regions the legal minimum working age is 14–16 depending on local labour law, and typical roles at that age are things like retail assistance, babysitting, tutoring, or family-business help — always check your local regulations first.' },
    { question: 'What jobs hire at 15?', answer: 'At 15, common entry points include retail, food service, tutoring, camp counselling, and freelance digital work such as graphic design, again subject to your country\'s minimum working age rules.' },
    { question: 'What do finance jobs pay?', answer: 'Finance salaries vary widely by role and seniority — entry-level analyst roles typically pay less than specialised or senior roles such as investment banking, private equity, or finance leadership, which are among the higher paying jobs in most markets.' },
    { question: 'What jobs make the most money?', answer: 'Roles in AI/ML engineering, specialised data engineering, cloud architecture and DevOps, senior software engineering, and executive or finance leadership positions are consistently among the highest paying jobs, particularly with a few years of experience.' },
    { question: 'How to find remote jobs?', answer: 'Use a job aggregator that tags listings by remote status, set filters for "remote job openings" or "fully remote jobs," and check company career pages directly for remote-first employers. InternFlow\'s remote jobs section aggregates listings from multiple sources daily.' },
    { question: 'How long does an internship interview take?', answer: 'Most internship interviews run 20–45 minutes, sometimes across one or two rounds — a screening call followed by a technical or behavioural round for competitive programs.' },
    { question: 'How to apply for an internship?', answer: 'Shortlist roles that match your skills, tailor your resume and a short cover letter to each, apply through the company portal or a listings site, and track your applications so you can follow up at the right time.' },
    { question: 'Are internships paid?', answer: 'Many internships are paid, especially in tech, engineering, and finance, though some — particularly in smaller companies or certain industries — are unpaid or offer only a stipend. Always check the listing details before applying.' },
    { question: 'How to make a resume stand out?', answer: 'Lead with measurable outcomes instead of duties ("reduced load time by 35%" instead of "worked on performance"), keep formatting clean and ATS-friendly, and tailor keywords to each job description rather than sending one generic resume everywhere.' },
    { question: 'What is a resume?', answer: 'A resume is a concise document — usually one page for students and early-career candidates — summarising your education, skills, projects, and experience for a specific job or internship application.' },
    { question: 'How long should a resume be?', answer: 'For students and early-career applicants, one page is standard. Experienced professionals can extend to two pages if the extra content is genuinely relevant.' },
    { question: 'How to make a resume for first job?', answer: 'Lead with education and any projects, coursework, or internships, add technical and soft skills relevant to the role, and use action verbs with specific outcomes wherever possible, even for academic or personal projects.' },
    { question: 'How to add a resume to LinkedIn?', answer: 'On your LinkedIn profile, go to the "Featured" or "About" section (or Resume upload under "More"), choose "Add media" or "Upload resume," and select your PDF file. Keep your profile summary consistent with the resume you upload.' },
    { question: 'How to create a resume?', answer: 'Start from a clean, ATS-friendly template, list your contact info, education, skills, and experience or projects in reverse-chronological order, and keep formatting simple — a resume builder like InternFlow\'s can generate ATS-ready bullets directly from your GitHub activity.' },
    { question: 'What is a data engineer?', answer: 'A data engineer builds and maintains the pipelines and infrastructure that move, clean, and store data so it can be used for analytics, machine learning, and reporting — distinct from a data analyst, who mostly works with data that\'s already prepared.' },
    { question: 'How to become a data engineer?', answer: 'Learn SQL, Python, and a distributed data framework such as Spark, get comfortable with cloud platforms (AWS, GCP, or Azure), build a portfolio of pipeline projects, and consider a certification such as the AWS Data Engineer certification to validate your skills.' },
    { question: 'What does a data engineer do?', answer: 'A data engineer designs data pipelines, manages databases and warehouses, ensures data quality and reliability, and works closely with data scientists and analysts to make sure the data they need is accurate and accessible.' },
    { question: 'How much does a data engineer make?', answer: 'Data engineer salaries vary by country, company, and seniority, but the role consistently ranks among the higher paying jobs in tech due to strong demand — check current data engineer salary listings on job boards for numbers specific to your market and experience level.' },
    { question: 'What is ATS?', answer: 'ATS stands for Applicant Tracking System — software that companies use to collect, scan, and rank resumes before a human recruiter sees them.' },
    { question: 'What is ATS friendly resume?', answer: 'An ATS-friendly resume uses standard section headings, simple formatting without tables or graphics that confuse parsers, and keywords that match the job description, so the applicant tracking system can read and rank it correctly.' },
    { question: 'What is an ATS system?', answer: 'An ATS system is the software recruiters use to manage job applications — parsing resumes into structured data, filtering by keywords, and tracking each candidate through the hiring pipeline.' },
    { question: 'What is ATS in recruiting?', answer: 'In recruiting, ATS refers to the Applicant Tracking System that automates sorting and screening of incoming applications, which is why formatting your resume to be machine-readable matters as much as the content itself.' },
    { question: 'How long should a cover letter be?', answer: 'A cover letter should generally fit on one page — three to four short paragraphs are enough to introduce yourself, connect your experience to the role, and close with a clear next step.' },
    { question: 'How to prepare for an interview?', answer: 'Research the company and role, review common interview questions for your field, prepare a few STAR-method stories from your experience, and prepare a short list of questions to ask the interviewer at the end.' },
    { question: 'What to wear to an interview?', answer: 'When in doubt, dress slightly more formally than the company\'s everyday dress code — business casual is a safe default for most tech and corporate interviews, while roles in finance or law often expect full formal wear.' },
    { question: 'What are the 7 most common interview questions and answers?', answer: 'Common questions include "Tell me about yourself," "Why do you want this role," "What are your strengths and weaknesses," "Describe a challenge you overcame," "Where do you see yourself in five years," "Why should we hire you," and "Do you have any questions for us" — prepare a short, specific answer for each ahead of time.' },
    { question: 'What questions to ask at the end of an interview?', answer: 'Good questions include what success looks like in the first 90 days, what the team\'s biggest current challenge is, how the role has evolved, and what the next steps in the process are.' },
    { question: 'How to prepare for a phone interview?', answer: 'Keep your resume and notes in front of you, find a quiet space with good signal, speak a little slower and more clearly than usual since there\'s no body language to help, and have a couple of questions ready for the interviewer.' },
    { question: 'How to use LinkedIn?', answer: 'Complete your profile with a clear headline, summary, and experience section, connect with classmates and professionals in your field, follow companies you\'re interested in, and use LinkedIn Jobs to search and apply directly.' },
    { question: 'What is internship definition?', answer: 'By definition, an internship is a temporary, supervised work experience — typically for students or recent graduates — designed to build practical skills and industry exposure rather than long-term employment.' },
    { question: 'What is the STAR method for interviews?', answer: 'STAR stands for Situation, Task, Action, Result — a structure for answering behavioural interview questions by describing the context, your specific responsibility, what you did, and the measurable outcome.' },
];

export default function HomeSEOContent() {
    const schema = faqSchema(faqs);
    return (<>
      <Script id="home-faq-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}/>

      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// about InternFlow</p>
        <h2 className="display text-2xl font-medium mb-6">Your job search, internship hunt, and resume — in one place</h2>
        <div className="prose max-w-3xl text-sm leading-relaxed space-y-4" style={{ color: 'var(--ink-soft)' }}>
          <p>
            InternFlow is built for students and early-career engineers chasing <strong>high paying jobs</strong>, real internships,
            and remote work — without juggling ten different tabs. Instead of manually checking company career pages, InternFlow
            crawls listings from across the web every day and organises them into <Link href="/jobs" className="underline">jobs</Link>,{' '}
            <Link href="/internships" className="underline">internships</Link>, <Link href="/remote-jobs" className="underline">remote jobs</Link>,
            and <Link href="/government-jobs" className="underline">government jobs</Link> — so you can search by role, skill, or
            company and actually find <strong>jobs near me</strong> or <strong>jobs hiring near me</strong> that match your profile.
          </p>
          <p>
            If you're specifically hunting for <strong>AI engineer jobs</strong>, <strong>DevOps jobs</strong>, or <strong>remote DevOps jobs</strong>,
            the platform surfaces current openings from company career pages and major boards like Indeed and LinkedIn Jobs, refreshed
            daily so listings stay live. The same is true for <strong>data engineer jobs</strong> — if you're wondering{' '}
            <strong>what is a data engineer</strong>, how to become one, or what a realistic <strong>data engineer salary</strong> looks like
            for your experience level, the jobs section, blog, and skill hubs walk through all of it, including how an{' '}
            <strong>AWS data engineer certification</strong> can strengthen an application.
          </p>
          <p>
            Beyond listings, InternFlow doubles as a career toolkit. The built-in <Link href="/resume" className="underline">resume builder</Link>{' '}
            turns your real GitHub commits and project work into ATS-ready bullet points — useful whether you're asking{' '}
            <strong>what is a resume</strong> for the first time or just want an <strong>ATS friendly resume template</strong> that
            actually clears automated screening. Pair that with the <Link href="/ats-checker" className="underline">ATS resume checker</Link>,
            which scores your resume against a specific job description, and the <Link href="/cover-letter" className="underline">cover letter generator</Link>,
            which drafts a tailored cover letter example in seconds so you're not staring at a blank page wondering{' '}
            <strong>how to write a cover letter</strong> from scratch.
          </p>
          <p>
            Internships are a first-class part of the platform too. Whether you're a <strong>software engineer intern</strong> candidate,
            eyeing a <strong>marketing intern</strong> or <strong>finance intern</strong> role, exploring{' '}
            <strong>cybersecurity internships</strong>, <strong>computer science internships</strong>, or a{' '}
            <strong>data analyst internship</strong>, or targeting specific programs like <strong>Google internships</strong>,{' '}
            <strong>EY internships</strong>, or a <strong>Cisco intern</strong> position, the internships feed pulls fresh listings and links
            each one to a company hub page so you can see everything else that employer has open. If you've ever asked{' '}
            <strong>what is an internship</strong>, <strong>do interns get paid</strong>, or just want to understand the{' '}
            <strong>internship definition</strong> before applying, that context lives right alongside the listings — including
            interview prep using the <strong>STAR method for interviews</strong>, common <strong>interview questions</strong>, and
            guidance on <strong>how to prepare for an interview</strong> from the first phone screen onward.
          </p>
          <p>
            For students specifically looking for flexible or entry-level work, InternFlow also tags <strong>part time remote jobs</strong>,{' '}
            <strong>part time jobs near me</strong>, <strong>entry level jobs</strong>, <strong>data entry jobs</strong>,{' '}
            <strong>summer jobs</strong>, <strong>nursing jobs</strong>, and <strong>engineering jobs</strong>, alongside dedicated sections
            for <strong>remote jobs no experience</strong>, <strong>remote job opportunities</strong>, <strong>customer service remote jobs</strong>,
            and roles from large employers like <strong>Amazon jobs</strong>. Every listing links back to a LinkedIn profile checklist,
            resume tips, and interview prep, so the whole loop — from finding a role to landing it — happens in one workspace instead
            of scattered across job boards, resume tools, and interview guides. That's the core idea behind InternFlow: less time
            hunting across sites, more time actually applying.
          </p>
        </div>
      </ScrollReveal>
    </>);
}

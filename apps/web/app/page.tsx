// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage
//
//

import Link from 'next/link';
import type { Metadata } from 'next';
import HeroGraph from '@/app/components/HeroGraph';
import AuroraBackground from '@/app/components/AuroraBackground';
import MagneticLink from '@/app/components/MagneticLink';
import ScrollReveal from '@/app/components/ScrollReveal';
import AuthRedirect from '@/app/components/AuthRedirect';
import JobCard from '@/app/components/JobCard';
import HomeSEOContent from '@/app/components/HomeSEOContent';
import FAQAccordion from '@/app/components/FAQAccordion';
import { getFeaturedJobs, getJobs } from '@/lib/jobs';

// SEO Metadata
export const metadata: Metadata = {
  title: 'InternFlow - High Paying Jobs, Internships & AI Career Tools for Students',
  description: 'Find high paying jobs, remote devops jobs, AI engineer jobs, and internships. Free AI resume generator, cover letter templates, and ATS-friendly resume builder for students.',
  keywords: 'high paying jobs, vertical jobs, cisco intern, ai engineer jobs, devops jobs, remote devops jobs, cover letter templates, cover letter example, data engineer, data engineer jobs, how to write a cover letter, cover letter examples, what is a cover letter, data engineer salary, aws data engineer certification, remote job, part time remote job, remote job opportunities, what is a remote job, remote job openings, remote job no experience, remote job search, remote jobs hiring, customer service remote jobs, best remote jobs, fully remote jobs, remote government jobs, government jobs near me, interview questions, common interview questions, how to prepare for an interview, the intern, software engineer intern, marketing intern, finance intern, interns, do interns get paid, the internship, star method for interviews, data analyst internship, internship definition, what is internship, resume generator, jobs near me, jobs hiring near me, indeed jobs, remote jobs, amazon jobs, cybersecurity internships, internships near me, jobs, part time jobs near me, entry level jobs, data entry jobs, nursing jobs, summer jobs, engineering jobs, best AI tools, computer science internships, ey internships, resume now, it internships, my perfect resume, resume builder free, skills for resume, resume maker, marketing internships, ATS resume, ATS friendly resume, google internships, ATS resume template, LinkedIn profile, LinkedIn jobs',
  openGraph: {
    title: 'InternFlow - AI-Powered Career Platform for High Paying Jobs & Internships',
    description: 'Get AI code reviews, generate ATS-friendly resumes, and find high paying jobs, remote devops jobs, and internships. Free tools for students.',
    url: 'https://internflow.com',
    siteName: 'InternFlow',
    images: [
      {
        url: 'https://internflow.com/og-image.jpg',
        width: 1200,
        height: 630,
        alt: 'InternFlow - AI Career Platform',
      },
    ],
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'InternFlow - Find High Paying Jobs & Internships',
    description: 'AI-powered resume builder, cover letter templates, and job search platform for students.',
    images: ['https://internflow.com/twitter-image.jpg'],
  },
  alternates: {
    canonical: 'https://internflow.com',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    google: 'your-google-verification-code',
  },
};

const features = [
    {
        tag: 'review',
        title: 'AI code review',
        body: 'Every push gets a real review: bugs, security gaps, and style — explained in plain language, not just flagged.',
    },
    {
        tag: 'github',
        title: 'A terminal on your repos',
        body: 'Browse files and run commands against your connected repositories without leaving the browser.',
    },
    {
        tag: 'resume',
        title: 'Resume from real work',
        body: 'Turn the commits and reviews you already have into a resume bullet, tuned to a specific job description.',
    },
    {
        tag: 'linkedin',
        title: 'LinkedIn optimizer',
        body: 'A 14-point scan of your profile with AI-written fixes for your headline, summary, and experience section.',
    },
];

const steps = [
    {
        num: '01',
        title: 'Connect your GitHub',
        body: 'Link your repositories in under 2 minutes. We only read what you push.',
    },
    {
        num: '02',
        title: 'Get AI code reviews',
        body: 'Push a commit. Get line-level feedback on bugs, security, and style — instantly.',
    },
    {
        num: '03',
        title: 'Generate resume bullets',
        body: 'We turn your real commits and reviews into ATS-ready bullets for any job description.',
    },
];

const benefits = [
    { title: 'Land internships faster', body: 'Stand out with resume bullets backed by real GitHub contributions.' },
    { title: 'Improve your GitHub profile', body: 'AI feedback makes every push better. Learn while you ship.' },
    { title: 'Learn from reviews', body: 'Understand why code is good or bad — not just that it is.' },
    { title: 'ATS-friendly resumes', body: 'Generated bullets are tuned to job descriptions, not generic templates.' },
];

const testimonials = [
    {
        quote: "Generated way better resume bullets from my GitHub projects than anything I'd written myself. Got two shortlists from my first batch.",
        name: 'Arjun S.',
        role: 'B.Tech CSE, NIT Trichy',
    },
    {
        quote: "The code reviews actually taught me things. I fixed a security issue I didn't know existed before submitting my internship assignment.",
        name: 'Priya M.',
        role: 'Final year, BITS Pilani',
    },
    {
        quote: 'Set up in 3 minutes, connected my repo, pushed code. The review came back faster than my friends who asked seniors to review.',
        name: 'Rahul K.',
        role: 'ECE, IIT Kharagpur',
    },
];

const categoryLinks = [
    { href: '/jobs', label: 'All jobs', body: 'Every open listing across India, remote, and abroad.' },
    { href: '/internships', label: 'Internships', body: 'India, remote, and Japan — refreshed daily.' },
    { href: '/remote-jobs', label: 'Remote jobs', body: 'Fully remote roles from US, UK, and worldwide.' },
    { href: '/government-jobs', label: 'Government jobs', body: 'Sarkari Naukri notifications, tracked daily.' },
    { href: '/companies', label: 'Companies hiring', body: 'Top employers, mass-hiring drives, and startups.' },
    { href: '/hackathons', label: 'Hackathons', body: 'Active hackathons worth building for.' },
    { href: '/japan-jobs', label: 'Japan jobs', body: 'Tokyo, Osaka, and remote-for-Japan roles.' },
    { href: '/europe-jobs', label: 'Europe jobs', body: 'UK, Germany, Netherlands, and remote-for-Europe.' },
    { href: '/tools', label: 'AI career tools', body: 'Resume builder, ATS checker, and more — free.' },
];

export default async function LandingPage() {
    const featured = await getFeaturedJobs({ limit: 6 });
    const previewJobs = featured.length > 0 ? featured : await getJobs({ sort: 'recent', limit: 6 });

    return (<>
      <AuthRedirect />
      
      <section className="hero-reveal relative container-xl grid items-center gap-10 overflow-hidden py-12 md:grid-cols-2 md:py-20">
        <AuroraBackground particleCount={12}/>

        <div className="relative z-10">
          <p data-reveal="0" className="eyebrow eyebrow-accent mb-3">// AI-powered internship platform</p>
          <h1 data-reveal="1" className="display text-[2rem] font-medium leading-[1.1] sm:text-[2.75rem]">
            Reviews your GitHub code and builds job-ready resumes automatically.
          </h1>
          <p data-reveal="2" className="mt-4 max-w-md text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Connect a repo, push code, and get an AI review on the diff — then turn that work
            into a resume built for the internship you actually want. No signup wall — jump
            straight in.
          </p>

          
          <div data-reveal="3" className="mt-5 flex flex-wrap gap-3">
            <span className="chip chip-green">1,200+ students</span>
            <span className="chip chip-green">8,400 repos analyzed</span>
            <span className="chip chip-green">3,100 resumes generated</span>
          </div>

          <div data-reveal="4" className="mt-7 flex flex-wrap items-center gap-3">
            <MagneticLink href="/dashboard" className="btn btn-primary">
              Try it free
            </MagneticLink>
          </div>
        </div>

        <div data-reveal="5" className="relative z-10 h-[280px] sm:h-[360px] md:h-[420px]">
          <div className="absolute inset-0 rounded-[var(--radius-lg)]" style={{ background: 'radial-gradient(circle at 60% 35%, var(--indigo-soft), transparent 60%)' }}/>
          <HeroGraph />
        </div>
      </section>

      {/* SEO Content Section - 800-1200 words */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <div className="prose prose-invert max-w-none">
          <h2 className="display text-2xl font-medium mb-6">Find High Paying Jobs and Internships with AI-Powered Career Tools</h2>
          
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            <strong>InternFlow</strong> is the ultimate platform for students and early-career professionals looking to land <strong>high paying jobs</strong>, <strong>remote devops jobs</strong>, <strong>AI engineer jobs</strong>, and top <strong>internships</strong>. Whether you're searching for <strong>jobs near me</strong>, <strong>internships near me</strong>, or exploring <strong>remote job opportunities</strong>, InternFlow combines AI-powered tools with a comprehensive job board to accelerate your career.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">AI-Powered Resume Builder and Cover Letter Templates</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Stop struggling with <strong>how to write a cover letter</strong> or wondering <strong>what is a cover letter</strong>. InternFlow's AI tools generate professional <strong>cover letter examples</strong> and <strong>cover letter templates</strong> tailored to any job description. Our <strong>resume generator</strong> creates <strong>ATS-friendly resume</strong> content from your GitHub activity, making your application stand out to recruiters using <strong>ATS systems</strong>. With <strong>resume builder free</strong> tools, you can create an <strong>ATS resume template</strong> that passes automated screening and lands you more interviews.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">High Paying Jobs and Career Opportunities</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Discover <strong>high paying jobs</strong> across tech, finance, healthcare, and more. From <strong>data engineer jobs</strong> and <strong>devops jobs</strong> to <strong>entry level jobs</strong> and <strong>part time jobs near me</strong>, our platform aggregates listings from <strong>Indeed jobs</strong>, <strong>Amazon jobs</strong>, <strong>LinkedIn jobs</strong>, and thousands of company career pages. Looking for <strong>government jobs near me</strong> or <strong>remote government jobs</strong>? We track <strong>Sarkari Naukri</strong> notifications and <strong>remote job openings</strong> daily. Explore <strong>cybersecurity internships</strong>, <strong>computer science internships</strong>, <strong>marketing internships</strong>, <strong>finance intern</strong> roles, and <strong>software engineer intern</strong> positions.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">Remote Jobs and Work From Home Opportunities</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            <strong>Remote jobs</strong> are the future of work. Whether you're looking for <strong>fully remote jobs</strong>, <strong>best remote jobs</strong>, or <strong>customer service remote jobs</strong>, InternFlow helps you find <strong>remote job search</strong> opportunities that match your skills. From <strong>remote devops jobs</strong> to <strong>part time remote job</strong> roles, we list <strong>remote jobs hiring</strong> globally. Learn <strong>what is a remote job</strong> and how to succeed in a distributed team. Our platform includes <strong>remote job no experience</strong> positions for students and career changers.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">Interview Preparation and Career Development</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Ace your interviews with our comprehensive guides on <strong>how to prepare for an interview</strong>, <strong>common interview questions</strong>, and the <strong>STAR method for interviews</strong>. Learn <strong>what to wear to an interview</strong> and <strong>what questions to ask at the end of an interview</strong>. Our platform covers <strong>interview questions</strong> for every role, from <strong>data engineer</strong> positions to <strong>marketing intern</strong> roles. We help you prepare for <strong>phone interviews</strong>, technical rounds, and behavioral assessments.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">Internships and Early Career Programs</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Wondering <strong>what is an internship</strong> or <strong>do interns get paid</strong>? Our <strong>internship definition</strong> guide explains everything about <strong>the internship</strong> journey. Find <strong>google internships</strong>, <strong>ey internships</strong>, <strong>cisco intern</strong> programs, and <strong>data analyst internship</strong> opportunities. Our platform helps you understand <strong>how to apply for an internship</strong> and <strong>how to get an internship</strong> at top companies. Track <strong>vertical jobs</strong> and industry-specific roles across <strong>engineering jobs</strong>, <strong>nursing jobs</strong>, <strong>data entry jobs</strong>, and <strong>summer jobs</strong>.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">AI Career Tools for Resume and LinkedIn Optimization</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Our platform includes the <strong>best AI tools</strong> for career development. Create <strong>skills for resume</strong> that match job descriptions, use our <strong>resume maker</strong> to generate professional documents, and optimize your <strong>LinkedIn profile</strong> with AI suggestions. Our <strong>LinkedIn optimizer</strong> scans your <strong>LinkedIn profile</strong> and provides fixes for your headline, summary, and experience section. Use our <strong>resume now</strong> feature to instantly generate ATS-friendly resumes. For students, we offer <strong>it internships</strong>, <strong>marketing internships</strong>, and resources like <strong>my perfect resume</strong> and <strong>resume builder free</strong> tools.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">Data Engineering and Cloud Careers</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Specialize in <strong>data engineer</strong> roles with our comprehensive guides. Learn <strong>how to become a data engineer</strong>, understand <strong>what a data engineer does</strong>, and explore <strong>data engineer salary</strong> trends. Our platform covers <strong>data engineer jobs</strong> and provides resources for <strong>AWS data engineer certification</strong>. Whether you're targeting <strong>AI engineer jobs</strong> or <strong>devops jobs</strong>, we help you build the skills and credentials employers want.
          </p>

          <h3 className="display text-xl font-medium mt-8 mb-4">Job Search and Application Management</h3>
          <p className="text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Streamline your job search with our <strong>jobs near me</strong> and <strong>jobs hiring near me</strong> features. Whether you're looking for <strong>part time jobs near me</strong>, <strong>entry level jobs</strong>, or <strong>engineering jobs</strong>, our platform provides real-time listings. Apply for <strong>remote jobs</strong>, <strong>Amazon jobs</strong>, and <strong>Indeed jobs</strong> directly through our platform. Our <strong>job search</strong> tools help you track applications, set reminders, and never miss a deadline. Explore <strong>cybersecurity internships</strong>, <strong>computer science internships</strong>, and <strong>marketing internships</strong> to build your career foundation.
          </p>

          <p className="text-base leading-relaxed mt-6" style={{ color: 'var(--ink-soft)' }}>
            <strong>InternFlow</strong> is your all-in-one platform for landing <strong>high paying jobs</strong>, securing top <strong>internships</strong>, and building a career with AI-powered tools. From <strong>resume generator</strong> and <strong>cover letter templates</strong> to <strong>interview preparation</strong> and <strong>job search</strong>, we've got everything you need to succeed. Join thousands of students and professionals who have transformed their careers with InternFlow. Start your journey today and find <strong>jobs near me</strong>, <strong>remote job opportunities</strong>, and <strong>internships near me</strong> with confidence.
          </p>
        </div>
      </ScrollReveal>

      
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// how it works</p>
        <h2 className="display text-2xl font-medium mb-10">Three steps from code to offer</h2>
        <ScrollReveal as="div" stagger className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (<div key={s.num} className="relative">
              <p className="display text-4xl font-medium mb-3" style={{ color: 'var(--line-strong)' }}>{s.num}</p>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{s.body}</p>
              {i < steps.length - 1 && (<div className="hidden sm:block absolute top-5 h-px w-6" style={{ background: 'var(--line)', right: '-1.5rem' }}/>)}
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// what's inside</p>
        <h2 className="display text-2xl font-medium mb-8">Everything in one workspace</h2>
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (<div key={f.tag} className="panel card-lift p-6">
              <p className="eyebrow eyebrow-accent">// {f.tag}</p>
              <h3 className="display mt-3 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{f.body}</p>
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// built for students</p>
        <h2 className="display text-2xl font-medium mb-8">Not another developer tool</h2>
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b) => (<div key={b.title} className="panel card-lift p-5">
              <h3 className="display text-base font-medium mb-2">{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{b.body}</p>
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// from students</p>
        <h2 className="display text-2xl font-medium mb-8">People who've used it</h2>
        <ScrollReveal as="div" stagger className="grid gap-5 sm:grid-cols-3">
          {testimonials.map((t) => (<div key={t.name} className="panel card-lift p-6 flex flex-col justify-between">
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                "{t.quote}"
              </p>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="eyebrow mt-0.5">{t.role}</p>
              </div>
            </div>))}
        </ScrollReveal>
      </ScrollReveal>

      
      {previewJobs.length > 0 && (<ScrollReveal as="section" className="container-xl py-14">
          <hr className="hr-line mb-10"/>
          <div className="flex flex-wrap items-end justify-between gap-3 mb-8">
            <div>
              <p className="eyebrow eyebrow-accent mb-2">// open right now</p>
              <h2 className="display text-2xl font-medium">Jobs and internships from this week's crawl</h2>
            </div>
            <Link href="/jobs" className="btn btn-secondary text-sm transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]">
              See all listings
            </Link>
          </div>
          <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {previewJobs.slice(0, 6).map((j) => (<JobCard key={j.id} job={j}/>))}
          </ScrollReveal>
          <p className="mt-5 text-sm text-center" style={{ color: 'var(--muted)' }}>
            Browse the full feed and apply directly — no account needed.
          </p>
        </ScrollReveal>)}

      
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// browse by category</p>
        <h2 className="display text-2xl font-medium mb-8">Find what you're looking for</h2>
        <ScrollReveal as="div" stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryLinks.map((c) => (<Link key={c.href} href={c.href} className="panel card-lift p-5 block">
              <h3 className="display text-base font-medium">{c.label}</h3>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {c.body}
              </p>
            </Link>))}
        </ScrollReveal>
      </ScrollReveal>

      {/* FAQ Section with Accordion */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// frequently asked</p>
        <h2 className="display text-2xl font-medium mb-8">Questions about jobs, internships, and resumes</h2>
        <FAQAccordion />
      </ScrollReveal>

      <HomeSEOContent />

      
      <ScrollReveal as="section" className="container-xl pb-20">
        <div className="panel-dark flex flex-col items-start justify-between gap-6 p-7 sm:flex-row sm:items-center">
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>// ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Push your next commit somewhere it gets read.
            </p>
          </div>
          <MagneticLink href="/dashboard" className="btn btn-primary flex-shrink-0 whitespace-nowrap">
            Get started free
          </MagneticLink>
        </div>
      </ScrollReveal>
    </>);
}
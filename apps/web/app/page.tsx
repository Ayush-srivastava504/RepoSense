// Module: app/page.tsx
// Defines component(s)/export(s): LandingPage
//
//

import Link from 'next/link';
import HeroGraph from '@/app/components/HeroGraph';
import AuroraBackground from '@/app/components/AuroraBackground';
import MagneticLink from '@/app/components/MagneticLink';
import ScrollReveal from '@/app/components/ScrollReveal';
import AuthRedirect from '@/app/components/AuthRedirect';
import JobCard from '@/app/components/JobCard';
import HomeSEOContent from '@/app/components/HomeSEOContent';
import { getFeaturedJobs, getJobs } from '@/lib/jobs';

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

const faqs = [
    {
        question: 'Is InternFlow free to use?',
        answer: 'Yes! InternFlow is completely free for students. No credit card required, no hidden charges.'
    },
    {
        question: 'Do I need a GitHub account?',
        answer: 'Yes, you\'ll need a GitHub account to connect your repositories. We only read your code for analysis and never store it.'
    },
    {
        question: 'How does the AI code review work?',
        answer: 'Our AI analyzes your commit diffs and provides line-level feedback on code quality, security vulnerabilities, performance issues, and best practices.'
    },
    {
        question: 'Can I use InternFlow without GitHub?',
        answer: 'Currently, GitHub integration is required for code reviews and resume generation. You can still browse jobs without connecting your account.'
    },
    {
        question: 'How accurate are the resume bullets?',
        answer: 'Our AI generates bullets based on your actual commits, PR descriptions, and code changes — making them more authentic than generic templates.'
    },
    {
        question: 'Is my code safe?',
        answer: 'Absolutely. We only read your code during the review process and never store or share it. Your privacy and intellectual property are protected.'
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

      {/* FAQ Section */}
      <ScrollReveal as="section" className="container-xl py-14">
        <hr className="hr-line mb-10"/>
        <p className="eyebrow eyebrow-accent mb-2">// got questions?</p>
        <h2 className="display text-2xl font-medium mb-8">Frequently asked questions</h2>
        <ScrollReveal as="div" stagger className="grid gap-4 md:grid-cols-2">
          {faqs.map((faq, index) => (
            <div key={index} className="panel card-lift p-6 hover:shadow-lg transition-shadow duration-200">
              <h3 className="display text-base font-medium mb-2">{faq.question}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {faq.answer}
              </p>
            </div>
          ))}
        </ScrollReveal>
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
'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import HeroGraph from '@/app/components/HeroGraph';
import { motion, useInView } from 'framer-motion';

const features = [
  {
    tag: 'review',
    title: 'AI code review',
    body: 'Every push gets a real review: bugs, security gaps, and style — explained in plain language.',
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

const previewJobs = [
  { title: 'Data Analyst Intern', company: 'Razorpay', location: 'Bangalore', tag: 'New' },
  { title: 'Python Developer Intern', company: 'Zepto', location: 'Mumbai', tag: 'Hot' },
  { title: 'AI/ML Intern', company: 'Sarvam AI', location: 'Remote', tag: 'New' },
  { title: 'Backend Intern', company: 'CRED', location: 'Bangalore', tag: '' },
  { title: 'Frontend Intern', company: 'Groww', location: 'Bangalore', tag: '' },
  { title: 'Full Stack Intern', company: 'Meesho', location: 'Remote', tag: 'Hot' },
];

// Framer Motion variants
const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0 }
};

const staggerContainer = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15
    }
  }
};

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isVisible, setIsVisible] = useState({});

  useEffect(() => {
    if (!loading && user && !user.is_guest) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            setIsVisible(prev => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.15, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('.reveal').forEach(el => {
      if (!el.id) el.id = `section-${Math.random().toString(36).substr(2, 9)}`;
      observer.observe(el);
    });
    
    return () => observer.disconnect();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="loader"></div>
      </div>
    );
  }

  return (
    <div className="shell">
      {/* HERO SECTION */}
      <section className="hero-section relative container-xl grid items-center gap-10 py-16 md:py-24 lg:py-28 overflow-hidden animated-bg md:grid-cols-2">
        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>
        <div className="particles"></div>
        
        {/* Left Column - Content */}
        <div className="relative z-10">
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="eyebrow eyebrow-accent mb-4 inline-block px-4 py-1 rounded-full border border-indigo-500/20 bg-indigo-500/5"
          >
            AI-powered internship platform
          </motion.p>
          
          <motion.h1 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.21, 0.92, 0.3, 1] }}
            className="display text-[2.4rem] leading-[1.05] sm:text-[3.2rem] lg:text-[3.8rem] font-medium tracking-[-0.02em]"
          >
            Reviews your GitHub code and builds job-ready resumes automatically.
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="mt-6 max-w-md text-[1.1rem] leading-relaxed text-balance" 
            style={{ color: 'var(--ink-soft)' }}
          >
            Connect a repo, push code, and get an AI review on the diff — then turn that work
            into a resume built for the internship you actually want. No signup wall — jump straight in.
          </motion.p>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-6 flex flex-wrap gap-3"
          >
            <span className="chip chip-green">1,200+ students</span>
            <span className="chip chip-green">8,400 repos analyzed</span>
            <span className="chip chip-green">3,100 resumes generated</span>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 25 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Link href="/dashboard" className="btn btn-primary btn-hover magnetic text-lg px-10 py-4 rounded-xl shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-300">
              Try it free
            </Link>
            <Link href="/github" className="btn btn-secondary btn-hover text-lg px-8 py-4 rounded-xl">
              See demo
            </Link>
          </motion.div>
        </div>

        {/* Right Column - 3D Graph */}
        <motion.div 
          initial={{ opacity: 0, scale: 0.9, rotate: -2 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          transition={{ delay: 0.4, duration: 1.1, ease: "easeOut" }}
          className="relative h-[320px] sm:h-[400px] md:h-[480px] flex items-center justify-center"
        >
          <div className="absolute inset-0 rounded-[var(--radius-lg)] bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent" />
          <div className="relative w-full h-full">
            <HeroGraph />
          </div>
        </motion.div>
      </section>

      {/* HOW IT WORKS */}
      <motion.section 
        className="container-xl py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <hr className="hr-line mb-10" />
        <motion.p variants={fadeInUp} className="eyebrow eyebrow-accent mb-2">How it works</motion.p>
        <motion.h2 variants={fadeInUp} className="display text-2xl font-medium mb-10">Three steps from code to offer</motion.h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div 
              key={s.num} 
              className="relative p-6 rounded-xl border border-gray-200/50 bg-white/50 backdrop-blur-sm hover:border-indigo-300 transition-all duration-300 hover:shadow-xl"
              variants={fadeInUp}
              whileHover={{ y: -8, transition: { duration: 0.3 } }}
            >
              <p className="display text-5xl font-bold mb-3 bg-gradient-to-r from-indigo-500 to-purple-500 bg-clip-text text-transparent">{s.num}</p>
              <h3 className="display text-lg font-medium">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{s.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* FEATURES */}
      <motion.section 
        className="container-xl py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <hr className="hr-line mb-10" />
        <motion.p variants={fadeInUp} className="eyebrow eyebrow-accent mb-2">What's inside</motion.p>
        <motion.h2 variants={fadeInUp} className="display text-2xl font-medium mb-10">Everything in one workspace</motion.h2>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div 
              key={f.tag} 
              className="panel p-6 relative overflow-hidden hover:shadow-xl transition-all duration-300"
              variants={fadeInUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
            >
              <p className="eyebrow eyebrow-accent">{f.tag}</p>
              <h3 className="display mt-2 text-xl font-medium">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{f.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* BENEFITS */}
      <motion.section 
        className="container-xl py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <hr className="hr-line mb-10" />
        <motion.p variants={fadeInUp} className="eyebrow eyebrow-accent mb-2">Built for students</motion.p>
        <motion.h2 variants={fadeInUp} className="display text-2xl font-medium mb-10">Not another developer tool</motion.h2>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((b, i) => (
            <motion.div 
              key={b.title} 
              className="panel p-6 hover:shadow-xl transition-all duration-300"
              variants={fadeInUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
            >
              <h3 className="display text-base font-medium mb-2">{b.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{b.body}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* TESTIMONIALS */}
      <motion.section 
        className="container-xl py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <hr className="hr-line mb-10" />
        <motion.p variants={fadeInUp} className="eyebrow eyebrow-accent mb-2">From students</motion.p>
        <motion.h2 variants={fadeInUp} className="display text-2xl font-medium mb-10">People who've used it</motion.h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div 
              key={t.name} 
              className="panel p-6 flex flex-col justify-between hover:shadow-xl transition-all duration-300"
              variants={fadeInUp}
              whileHover={{ y: -6, transition: { duration: 0.3 } }}
            >
              <p className="text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                "{t.quote}"
              </p>
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--line)' }}>
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="eyebrow mt-0.5">{t.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* JOB PREVIEW */}
      <motion.section 
        className="container-xl py-16"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <hr className="hr-line mb-10" />
        <div className="flex flex-wrap items-end justify-between gap-3 mb-10">
          <div>
            <motion.p variants={fadeInUp} className="eyebrow eyebrow-accent mb-2">Latest internships</motion.p>
            <motion.h2 variants={fadeInUp} className="display text-2xl font-medium">Refreshed daily</motion.h2>
          </div>
          <motion.div variants={fadeInUp}>
            <Link href="/jobs" className="btn btn-secondary text-sm btn-hover">
              See all
            </Link>
          </motion.div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {previewJobs.map((j, i) => (
            <motion.div 
              key={i} 
              className="panel p-5 hover:shadow-xl transition-all duration-300 cursor-pointer"
              variants={fadeInUp}
              whileHover={{ y: -4, transition: { duration: 0.3 } }}
            >
              <div className="flex items-center gap-2 flex-wrap">
                <p className="display text-base font-medium">{j.title}</p>
                {j.tag && <span className={`chip text-[0.65rem] ${j.tag === 'Hot' ? 'chip-rust' : 'chip-green'}`}>{j.tag}</span>}
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--ink-soft)' }}>{j.company}</p>
              <p className="eyebrow mt-1">{j.location}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* CLOSING CTA */}
      <motion.section 
        className="container-xl pb-20"
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        variants={staggerContainer}
      >
        <motion.div 
          className="panel-dark flex flex-col items-start justify-between gap-6 p-8 sm:flex-row sm:items-center rounded-2xl bg-gradient-to-br from-indigo-900/90 to-purple-900/90 backdrop-blur-sm border border-indigo-400/20"
          variants={fadeInUp}
          whileHover={{ scale: 1.01, transition: { duration: 0.3 } }}
        >
          <div>
            <p className="eyebrow" style={{ color: '#9ea3ab' }}>Ready when you are</p>
            <p className="display mt-2 text-xl font-medium text-white sm:text-2xl">
              Push your next commit somewhere it gets read.
            </p>
          </div>
          <Link href="/dashboard" className="btn btn-primary btn-hover px-8 py-3 text-lg shadow-lg shadow-indigo-500/30 hover:shadow-indigo-500/50 transition-all duration-300">
            Get started free
          </Link>
        </motion.div>
      </motion.section>
    </div>
  );
}
export interface ToolFaq {
  question: string;
  answer: string;
}

export interface ToolDefinition {
  slug: string;
  name: string;
  shortName: string;
  tagline: string;
  metaTitle: string;
  metaDescription: string;
  heroDescription: string;
  ctaHref: string;
  ctaLabel: string;
  category: string;
  benefits: string[];
  howItWorks: { name: string; text: string }[];
  faqs: ToolFaq[];
  relatedSlugs: string[];
}

export const TOOLS: ToolDefinition[] = [
  {
    slug: 'github-readme-generator',
    name: 'GitHub README Generator',
    shortName: 'README Generator',
    tagline: 'Turn any repo into a README recruiters actually read',
    metaTitle: 'Free AI GitHub README Generator for Student Projects',
    metaDescription:
      'Generate a professional, recruiter-ready README for any GitHub repository in seconds. Free AI README generator built for student and open-source projects.',
    heroDescription:
      "Paste a repo URL and InternFlow's AI reads your commit history, file structure, and code to write a clear, well-formatted README — complete with setup instructions, tech stack, and highlights recruiters look for.",
    ctaHref: '/github',
    ctaLabel: 'Generate my README',
    category: 'Developer Tools',
    benefits: [
      'Analyzes your actual code and commits instead of generic templates',
      'Adds a tech-stack summary that matches what your repo really uses',
      'Writes setup and usage instructions automatically',
      'Formats everything in clean, GitHub-flavored Markdown',
    ],
    howItWorks: [
      { name: 'Connect your repository', text: 'Sign in with GitHub and pick the repository you want a README for.' },
      { name: 'AI analyzes your code', text: 'InternFlow scans your file structure, dependencies, and commit history to understand what the project does.' },
      { name: 'Get a polished README', text: 'Review the generated README, tweak any section, and copy it straight into your repo.' },
    ],
    faqs: [
      {
        question: 'Is the GitHub README generator free?',
        answer:
          'Yes. Generating a README is free for students; you only need an InternFlow account connected to GitHub.',
      },
      {
        question: 'Will it work on a private repository?',
        answer:
          'Yes, as long as you authorize InternFlow to read that repository through GitHub OAuth, private repos work the same way as public ones.',
      },
      {
        question: 'Can I edit the README after it is generated?',
        answer:
          'Yes. The generated README is fully editable before you copy or commit it, so you can adjust tone, add screenshots, or reorder sections.',
      },
    ],
    relatedSlugs: ['ats-resume-checker', 'resume-builder', 'application-tracker'],
  },
  {
    slug: 'ats-resume-checker',
    name: 'ATS Resume Checker',
    shortName: 'ATS Checker',
    tagline: 'See your resume the way an applicant tracking system does',
    metaTitle: 'Free ATS Resume Checker & Score — InternFlow',
    metaDescription:
      'Check your resume against applicant tracking system (ATS) rules for free. Get an ATS score, keyword gaps, and formatting fixes before you apply.',
    heroDescription:
      'Most student resumes get filtered out before a human ever sees them. InternFlow scores your resume against real ATS parsing rules — formatting, section headers, and keyword match for your target role — for five roles: Software Engineer, AI/ML Engineer, DevOps Engineer, Data Engineer, and Data Analyst. Pick your role and see exactly what to fix before you apply.',
    ctaHref: '/ats-checker',
    ctaLabel: 'Check my resume score',
    category: 'Career Tools',
    benefits: [
      'Get a numeric ATS score with a clear breakdown of what hurt it',
      'Flags formatting choices that break ATS parsing (tables, columns, images)',
      'Compares your resume keywords against a target job description',
      'Suggests specific bullet-level rewrites, not vague advice',
    ],
    howItWorks: [
      { name: 'Upload or build your resume', text: 'Bring an existing resume or build one from scratch in the resume builder.' },
      { name: 'Run the ATS check', text: 'InternFlow parses your resume the way an ATS would and flags formatting or keyword issues.' },
      { name: 'Fix and re-check', text: 'Apply the suggested fixes and re-run the check until your ATS score is strong.' },
    ],
    faqs: [
      {
        question: 'What is an ATS resume score?',
        answer:
          'It is an estimate of how cleanly an applicant tracking system can parse and rank your resume, based on formatting, structure, and keyword match against a job description.',
      },
      {
        question: 'Does a high ATS score guarantee an interview?',
        answer:
          'No. It removes the technical reasons a resume gets auto-filtered, but a recruiter or hiring manager still makes the final call on content and fit.',
      },
      {
        question: 'Do I need a specific job description to check my resume?',
        answer:
          'No — pick your target role (Software Engineer, AI/ML Engineer, DevOps Engineer, Data Engineer, or Data Analyst) and InternFlow checks your resume against the keywords and formatting rules that role\'s applicant tracking systems actually look for.',
      },
    ],
    relatedSlugs: ['resume-builder', 'cover-letter-generator', 'job-match-score'],
  },
  {
    slug: 'resume-builder',
    name: 'AI Resume Builder',
    shortName: 'Resume Builder',
    tagline: 'Turn your GitHub projects into resume bullets that get interviews',
    metaTitle: 'AI Resume Builder for Engineering Students — InternFlow',
    metaDescription:
      'Build an ATS-ready resume in minutes. InternFlow turns your GitHub projects and coursework into strong, quantified resume bullets for internship and job applications.',
    heroDescription:
      'Most engineering students struggle to describe their projects in resume language. InternFlow reads your GitHub activity and turns it into quantified, ATS-friendly bullet points, then lays it out in a clean, exportable resume template.',
    ctaHref: '/resume/builder',
    ctaLabel: 'Build my resume',
    category: 'Career Tools',
    benefits: [
      'Converts GitHub projects into quantified resume bullets automatically',
      'Uses ATS-safe formatting so nothing gets lost in parsing',
      'Export straight to PDF for job applications',
      'Reusable sections you can adapt for different roles',
    ],
    howItWorks: [
      { name: 'Add your projects and experience', text: 'Pull in GitHub repos or add experience manually.' },
      { name: 'Let AI draft your bullets', text: 'InternFlow rewrites your project descriptions into quantified, action-driven resume bullets.' },
      { name: 'Export your resume', text: 'Download a clean, ATS-ready PDF ready to attach to applications.' },
    ],
    faqs: [
      {
        question: 'Can I import my GitHub projects directly?',
        answer:
          'Yes, connecting GitHub lets InternFlow pull in your repositories and turn the most relevant ones into resume bullets automatically.',
      },
      {
        question: 'Is the resume format ATS-friendly?',
        answer:
          'Yes, the builder uses a single-column, ATS-safe layout so applicant tracking systems can parse your sections correctly.',
      },
      {
        question: 'Can I make more than one version of my resume?',
        answer:
          'Yes, you can save multiple resume versions and tailor bullets for different roles or companies.',
      },
    ],
    relatedSlugs: ['ats-resume-checker', 'github-readme-generator', 'cover-letter-generator', 'job-match-score', 'application-tracker'],
  },
  {
    slug: 'linkedin-optimizer',
    name: 'LinkedIn Profile Optimizer',
    shortName: 'LinkedIn Optimizer',
    tagline: 'Get a LinkedIn headline and About section recruiters notice',
    metaTitle: 'AI LinkedIn Profile Optimizer for Students — InternFlow',
    metaDescription:
      'Optimize your LinkedIn headline, About section, and experience bullets with AI. Built for engineering students applying to internships and entry-level roles.',
    heroDescription:
      "Recruiters search LinkedIn before they open your resume. InternFlow rewrites your headline, About section, and experience bullets to match what recruiters actually search for, using the same project details from your resume.",
    ctaHref: '/linkedin',
    ctaLabel: 'Optimize my LinkedIn',
    category: 'Career Tools',
    benefits: [
      'Rewrites your headline to include searchable role keywords',
      'Turns a blank About section into a concise, specific summary',
      'Aligns your experience bullets with your resume',
      'Highlights the projects that matter most for your target role',
    ],
    howItWorks: [
      { name: 'Add your current profile details', text: 'Enter your current title, target role, and experience.' },
      { name: 'Generate optimized sections', text: 'InternFlow drafts a headline, About section, and experience bullets tailored to your target role.' },
      { name: 'Copy into LinkedIn', text: 'Paste the generated sections directly into your LinkedIn profile.' },
    ],
    faqs: [
      {
        question: 'Does this tool post directly to my LinkedIn profile?',
        answer:
          'No. It generates the text for your headline, About section, and experience bullets, which you copy into LinkedIn yourself.',
      },
      {
        question: 'Will it match the content on my resume?',
        answer:
          'Yes, it is designed to stay consistent with the projects and experience already on your InternFlow resume.',
      },
    ],
    relatedSlugs: ['resume-builder', 'ats-resume-checker'],
  },
  {
    slug: 'cover-letter-generator',
    name: 'AI Cover Letter Generator',
    shortName: 'Cover Letter Generator',
    tagline: 'A tailored cover letter for every application, in under a minute',
    metaTitle: 'Free AI Cover Letter Generator for Internships — InternFlow',
    metaDescription:
      'Generate a tailored cover letter for any internship or job application. InternFlow matches your resume and the job description to write a specific, non-generic letter.',
    heroDescription:
      'Generic cover letters get skipped. InternFlow reads the job description alongside your resume and drafts a short, specific cover letter that explains why you fit that particular role — not a template with the company name swapped in.',
    ctaHref: '/cover-letter',
    ctaLabel: 'Generate my cover letter',
    category: 'Career Tools',
    benefits: [
      'Matches your resume experience to the specific job description',
      'Avoids generic filler language and clichés',
      'Keeps letters short enough for recruiters to actually read',
      'Editable output so you can adjust tone before sending',
    ],
    howItWorks: [
      { name: 'Paste the job description', text: 'Add the internship or job posting you are applying to.' },
      { name: 'Link your resume', text: 'InternFlow pulls relevant experience from your existing resume.' },
      { name: 'Generate and edit', text: 'Review the drafted cover letter and adjust wording before sending it.' },
    ],
    faqs: [
      {
        question: 'Is the cover letter generator available now?',
        answer:
          'Yes. It is live on InternFlow — paste a job description and your resume text and it drafts a letter in under a minute.',
      },
      {
        question: 'Will the letter sound generic?',
        answer:
          'No, it is built to reference specifics from the job description and your resume rather than generic phrases, which is the main thing that makes cover letters sound templated.',
      },
    ],
    relatedSlugs: ['resume-builder', 'ats-resume-checker'],
  },
  {
    slug: 'application-tracker',
    name: 'Job Application Tracker',
    shortName: 'Application Tracker',
    tagline: 'Track every internship and job application in one pipeline',
    metaTitle: 'Free Job Application Tracker for Students — InternFlow',
    metaDescription:
      'Track every internship and job application from saved to offer in one free pipeline. Get deadline reminders so you never miss an application window again.',
    heroDescription:
      "Applying to dozens of internships across job boards means losing track of what you've applied to, what's overdue, and what deadline is coming up next. InternFlow's application tracker lets you save any listing in one click and move it through Saved → Applied → Interviewing → Offer, with deadline countdowns so nothing slips through the cracks. No account required — it stays in your browser.",
    ctaHref: '/tracker',
    ctaLabel: 'Open my tracker',
    category: 'Career Tools',
    benefits: [
      'Save any job or internship in one click, from the listing or detail page',
      'Move applications through Saved, Applied, Interviewing, Offer, and Rejected',
      'See deadline countdowns and a weekly heads-up before an application window closes',
      'No sign-up required — your pipeline stays private in your own browser',
    ],
    howItWorks: [
      { name: 'Save a listing', text: 'Tap the bookmark icon on any job or internship card to add it to your tracker.' },
      { name: 'Update its status', text: 'Move it from Saved to Applied, Interviewing, or Offer as your application progresses.' },
      { name: 'Watch your deadlines', text: 'Open /tracker to see every upcoming deadline sorted by urgency before it is too late to apply.' },
    ],
    faqs: [
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
    ],
    relatedSlugs: ['job-match-score', 'resume-builder', 'ats-resume-checker'],
  },
  {
    slug: 'job-match-score',
    name: 'AI Job Match Score',
    shortName: 'Job Match Score',
    tagline: 'See how well a listing fits your skills before you apply',
    metaTitle: 'Free AI Job Match Score for Students — InternFlow',
    metaDescription:
      'Get an instant AI match score on every job and internship listing based on your own skills, so you know which listings are worth your time before you apply.',
    heroDescription:
      "Every job board shows the same listings — none of them show how well a listing actually fits you. InternFlow's job match score compares your skills against each listing's title, description, and AI-extracted keywords to give you an instant 0–100% match score, plus exactly which of your skills matched and which are missing. Add your skills once and every job or internship card shows its match score automatically.",
    ctaHref: '/jobs',
    ctaLabel: 'See my matched jobs',
    category: 'Career Tools',
    benefits: [
      'Instant 0–100% match score on every job and internship card',
      'Shows exactly which of your skills matched the listing and which did not',
      'No resume upload needed — just a quick skill list, saved locally',
      'Helps you prioritize which listings are worth your time before you click apply',
    ],
    howItWorks: [
      { name: 'Add your skills', text: 'Enter a short comma-separated list of your skills — no resume upload required.' },
      { name: 'Browse jobs and internships', text: 'Every listing on InternFlow now shows a match score chip based on your skills.' },
      { name: 'Check the breakdown', text: 'Open a listing to see which of your skills matched and which ones are missing from that role.' },
    ],
    faqs: [
      {
        question: 'How is the job match score calculated?',
        answer:
          'It compares the skills you enter against a listing\'s title, AI-extracted keywords, and description, weighting a skill mentioned in the title or keywords more heavily than one only mentioned in the body text.',
      },
      {
        question: 'Do I need to upload my resume to get a match score?',
        answer:
          'No. Just enter a short list of your skills — the match score works without a resume upload or an account.',
      },
      {
        question: 'Is my skill list shared with anyone?',
        answer:
          'No, it is stored only in your own browser and used locally to score listings — it is not uploaded anywhere.',
      },
    ],
    relatedSlugs: ['application-tracker', 'resume-builder', 'ats-resume-checker'],
  },
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  return TOOLS.find((tool) => tool.slug === slug);
}

export function getRelatedTools(tool: ToolDefinition): ToolDefinition[] {
  return tool.relatedSlugs
    .map((slug) => getToolBySlug(slug))
    .filter((t): t is ToolDefinition => Boolean(t));
}

// Module: app/components/Footer.tsx
// Defines component(s)/export(s): Footer

'use client';
import Link from 'next/link';
import Logo from './Logo';
import { useTranslation } from '@/i18n/LanguageContext';

export default function Footer() {
  const { t } = useTranslation();

  const columns = [
    {
      headingKey: 'footer.product',
      fallbackHeading: 'Product',
      links: [
        { labelKey: 'nav.dashboard', fallback: 'Overview', href: '/dashboard' },
        { labelKey: 'nav.about', fallback: 'About', href: '/about' },
        { labelKey: 'nav.jobs', fallback: 'Jobs', href: '/jobs' },
        { labelKey: 'nav.internships', fallback: 'Internships', href: '/internships' },
        { labelKey: 'nav.remoteJobs', fallback: 'Remote jobs', href: '/remote-jobs' },
        { labelKey: 'nav.governmentJobs', fallback: 'Government jobs', href: '/government-jobs' },
        { labelKey: 'nav.companies', fallback: 'Companies', href: '/companies' },
        { labelKey: 'nav.skills', fallback: 'Browse by skill', href: '/skills' },
        { labelKey: 'nav.jobsByCity', fallback: 'Browse by city', href: '/jobs-in' },
        { labelKey: 'nav.careerPaths', fallback: 'Career paths', href: '/careers' },
        { labelKey: 'nav.resumeGuides', fallback: 'Resume guides', href: '/resume-for' },
        { labelKey: 'nav.hackathons', fallback: 'Hackathons', href: '/hackathons' },
        { labelKey: 'nav.japanJobs', fallback: 'Japan jobs & internships', href: '/japan-jobs' },
        { labelKey: 'nav.europeJobs', fallback: 'Europe jobs', href: '/europe-jobs' },
        { labelKey: 'nav.blog', fallback: 'Blog', href: '/blog' },
      ],
    },
    {
      headingKey: 'footer.interviewPrep',
      fallbackHeading: 'Interview prep',
      links: [
        { labelKey: 'nav.leetcode', fallback: 'LeetCode', href: '/leetcode' },
        { labelKey: 'nav.readmeGenerator', fallback: 'AI code review', href: '/github' },
      ],
    },
    {
      headingKey: 'footer.popularSkills',
      fallbackHeading: 'Popular skills',
      links: [
        { fallback: 'Python jobs', href: '/skills/python' },
        { fallback: 'React jobs', href: '/skills/react' },
        { fallback: 'SQL jobs', href: '/skills/sql' },
        { fallback: 'AWS jobs', href: '/skills/aws' },
        { fallback: 'Java jobs', href: '/skills/java' },
        { labelKey: 'nav.skills', fallback: 'All skills', href: '/skills' },
      ],
    },
    {
      headingKey: 'footer.aiTools',
      fallbackHeading: 'AI tools',
      links: [
        { labelKey: 'nav.allTools', fallback: 'All tools', href: '/tools' },
        { labelKey: 'nav.readmeGenerator', fallback: 'GitHub README generator', href: '/tools/github-readme-generator' },
        { labelKey: 'nav.atsChecker', fallback: 'ATS resume checker', href: '/tools/ats-resume-checker' },
        { labelKey: 'nav.resumeBuilder', fallback: 'Resume builder', href: '/tools/resume-builder' },
        { labelKey: 'nav.linkedinOptimizer', fallback: 'LinkedIn optimizer', href: '/tools/linkedin-optimizer' },
        { labelKey: 'nav.coverLetter', fallback: 'Cover letter generator', href: '/tools/cover-letter-generator' },
      ],
    },
    {
      headingKey: 'footer.account',
      fallbackHeading: 'Account',
      links: [
        { labelKey: 'nav.signIn', fallback: 'Sign in', href: '/login' },
        { fallback: 'Create account', href: '/register' },
      ],
    },
    {
      headingKey: 'footer.contact',
      fallbackHeading: 'Contact',
      links: [{ fallback: 'creatoramplified@gmail.com', href: 'mailto:creatoramplified@gmail.com' }],
    },
  ];

  return (
    <footer className="border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="container-xl py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {t('footer.tagline', 'AI code review and resume generation built for students, not enterprises.')}
            </p>
          </div>

          <div className="flex flex-wrap gap-10">
            {columns.map((col, idx) => (
              <div key={idx}>
                <p className="eyebrow eyebrow-accent mb-3">
                  // {t(col.headingKey, col.fallbackHeading).toLowerCase()}
                </p>
                <ul className="space-y-2">
                  {col.links.map((l, i) => (
                    <li key={i}>
                      <Link href={l.href} className="text-sm transition hover:underline" style={{ color: 'var(--ink-soft)' }}>
                        {l.labelKey ? t(l.labelKey, l.fallback) : l.fallback}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          className="mt-10 flex flex-col gap-3 border-t pt-6 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--line)' }}
        >
          <p className="eyebrow">
            © {new Date().getFullYear()} InternFlow — {t('footer.copyright', 'built for students, not enterprises')}
          </p>
          <p className="eyebrow">
            <a href="mailto:creatoramplified@gmail.com">creatoramplified@gmail.com</a>
            {' · '}
            {t('footer.madeIn', 'made in India')}
          </p>
        </div>
      </div>
    </footer>
  );
}

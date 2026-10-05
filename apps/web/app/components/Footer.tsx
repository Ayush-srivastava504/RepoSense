// Module: app/components/Footer.tsx
// Defines component(s)/export(s): Footer

import Link from 'next/link';
import Logo from './Logo';
import { BASE_URL } from '@/lib/site';

const COLUMNS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: 'Product',
    links: [
      { href: '/jobs', label: 'Jobs' },
      { href: '/internships', label: 'Internships' },
      { href: '/remote-jobs', label: 'Remote jobs' },
      { href: '/resume/builder', label: 'Resume builder' },
      { href: '/ats-checker', label: 'ATS resume checker' },
      { href: '/cover-letter', label: 'Cover letter generator' },
      { href: '/leetcode', label: 'Coding practice' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { href: '/careers', label: 'Career paths' },
      { href: '/resume-for', label: 'Resume guides' },
      { href: '/jobs-in', label: 'Jobs by city' },
      { href: '/batch', label: 'Jobs by batch' },
      { href: '/skills', label: 'Jobs by skill' },
      { href: '/companies', label: 'Companies hiring' },
      { href: '/blog', label: 'Blog' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { href: '/about', label: 'About' },
      { href: '/contact', label: 'Contact us' },
      { href: '/hackathons', label: 'Hackathons' },
      { href: '/government-jobs', label: 'Government jobs' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/privacy', label: 'Privacy Policy' },
      { href: '/terms', label: 'Terms of Service' },
    ],
  },
];

const linkStyle = { color: 'var(--ink-soft)' } as const;
const inline = 'underline underline-offset-2 transition hover:opacity-80';
const inlineStyle = { color: 'var(--ink)' } as const;

// Google's "preferred sources" deep link (developers.google.com/search/docs/appearance/preferred-sources).
// Domain-level only; it affects Top Stories for users who opt in.
const PREFERRED_SOURCE_URL = `https://www.google.com/preferences/source?q=${new URL(BASE_URL).host}`;

export default function Footer({ hiring }: { hiring?: React.ReactNode }) {
  return (
    <footer className="mt-8 border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="container-xl py-10 sm:py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-5">
          <div className="col-span-2 lg:col-span-1">
            <Link href="/" aria-label="InternFlow home" className="inline-block">
              <Logo />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed" style={linkStyle}>
              Job and internship discovery, resume tools and interview prep for college
              students and freshers in India.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{col.heading}</p>
              <ul className="mt-4 space-y-3">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm transition hover:underline" style={linkStyle}>
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <a
            href={PREFERRED_SOURCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition hover:opacity-80"
            style={{ borderColor: 'var(--line)', color: 'var(--ink)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 21 12 17.77 5.82 21 7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            Add InternFlow as a preferred source on Google
          </a>
          {hiring}
        </div>

        <div className="mt-10 border-t pt-8" style={{ borderColor: 'var(--line)' }}>
          <p className="max-w-3xl text-sm leading-relaxed" style={linkStyle}>
            InternFlow is a job and internship search platform for B.Tech, BCA, MCA, B.Sc and MBA
            freshers. Browse <Link href="/jobs" className={inline} style={inlineStyle}>fresher jobs</Link> and{' '}
            <Link href="/internships" className={inline} style={inlineStyle}>internships</Link>, explore{' '}
            <Link href="/careers/software-engineer" className={inline} style={inlineStyle}>software engineer</Link>,{' '}
            <Link href="/careers/data-engineer" className={inline} style={inlineStyle}>data engineer</Link> and{' '}
            <Link href="/careers/ai-ml-engineer" className={inline} style={inlineStyle}>AI/ML engineer</Link> careers, and
            get ready to apply with the free{' '}
            <Link href="/resume/builder" className={inline} style={inlineStyle}>resume builder</Link>,{' '}
            <Link href="/ats-checker" className={inline} style={inlineStyle}>ATS checker</Link> and{' '}
            <Link href="/cover-letter" className={inline} style={inlineStyle}>cover letter generator</Link>.
          </p>
        </div>

        <div
          className="mt-8 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
        >
          <p>© {new Date().getFullYear()} InternFlow. All rights reserved.</p>
          <p>
            <a href="mailto:creatoramplified@gmail.com" className="hover:underline">creatoramplified@gmail.com</a>
            {' · '}Made in India
          </p>
        </div>
      </div>
    </footer>
  );
}
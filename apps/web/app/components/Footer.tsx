import Link from 'next/link';
import Logo from './Logo';

const columns = [
  {
    heading: 'Product',
    links: [
      { label: 'Overview', href: '/dashboard' },
      { label: 'About', href: '/about' },
      { label: 'Jobs', href: '/jobs' },
      { label: 'Internships', href: '/internships' },
      { label: 'Remote jobs', href: '/remote-jobs' },
      { label: 'Government jobs', href: '/government-jobs' },
      { label: 'Companies', href: '/companies' },
      { label: 'Hackathons', href: '/hackathons' },
      { label: 'Japan jobs', href: '/japan-jobs' },
      { label: 'Japan internships', href: '/japan-jobs?type=internship' },
      { label: 'Europe jobs', href: '/europe-jobs' },
      { label: 'Blog', href: '/blog' },
    ],
  },
  {
    heading: 'AI tools',
    links: [
      { label: 'All tools', href: '/tools' },
      { label: 'GitHub README generator', href: '/tools/github-readme-generator' },
      { label: 'ATS resume checker', href: '/tools/ats-resume-checker' },
      { label: 'Resume builder', href: '/tools/resume-builder' },
      { label: 'LinkedIn optimizer', href: '/tools/linkedin-optimizer' },
      { label: 'Cover letter generator', href: '/tools/cover-letter-generator' },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Create account', href: '/register' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { label: 'creatoramplified@gmail.com', href: 'mailto:creatoramplified@gmail.com' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: 'var(--line)' }}>
      <div className="container-xl py-10">
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              AI code review and resume generation built for students, not enterprises.
            </p>
          </div>

          <div className="flex flex-wrap gap-10">
            {columns.map((col) => (
              <div key={col.heading}>
                <p className="eyebrow eyebrow-accent mb-3">// {col.heading.toLowerCase()}</p>
                <ul className="space-y-2">
                  {col.links.map((l) => (
                    <li key={l.href}>
                      <Link
                        href={l.href}
                        className="text-sm"
                        style={{ color: 'var(--ink-soft)' }}
                      >
                        {l.label}
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
          <p className="eyebrow">© {new Date().getFullYear()} InternFlow — built for students, not enterprises</p>
          <p className="eyebrow">
            <a href="mailto:creatoramplified@gmail.com">creatoramplified@gmail.com</a>
            {' · '}
            made in India
          </p>
        </div>
      </div>
    </footer>
  );
}

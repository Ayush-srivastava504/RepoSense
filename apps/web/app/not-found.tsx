// Module: app/not-found.tsx
// Defines component(s)/export(s): NotFound
//
//

import type { Metadata } from 'next';
import Link from 'next/link';
export const metadata: Metadata = {
    title: 'Page not found',
    robots: {
        index: false,
        follow: true,
    },
};
const links = [
    { href: '/jobs', label: 'Jobs' },
    { href: '/internships', label: 'Internships' },
    { href: '/remote-jobs', label: 'Remote jobs' },
    { href: '/government-jobs', label: 'Government jobs' },
    { href: '/companies', label: 'Companies hiring' },
    { href: '/hackathons', label: 'Hackathons' },
    { href: '/tools', label: 'AI career tools' },
    { href: '/blog', label: 'Blog' },
];
export default function NotFound() {
    return (<main className="mx-auto max-w-2xl px-4 py-20 text-center">
      <p className="eyebrow eyebrow-accent">// 404</p>

      <h1 className="display mt-2 text-2xl font-medium sm:text-3xl">
        This page doesn&apos;t exist
      </h1>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        The listing may have closed, or the link is broken. Here&apos;s
        where you probably wanted to go instead:
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {links.map((l) => (<Link key={l.href} href={l.href} className="chip chip-muted text-sm">
            {l.label}
          </Link>))}
      </div>

      <Link href="/" className="btn btn-primary mt-8 inline-block">
        Back to home
      </Link>
    </main>);
}

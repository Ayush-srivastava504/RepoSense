// Module: app/components/LandingNav.tsx
// Defines component(s)/export(s): LandingNav
// Floating top navigation for the public homepage (replaces the sidebar on "/").
// Mobile: collapses into a hamburger drawer. Theme toggle reuses Sidebar's ThemeToggle.

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Logo from './Logo';

const LINKS = [
  { href: '/jobs', label: 'Jobs' },
  { href: '/internships', label: 'Internships' },
  { href: '/jobs-in', label: 'By city' },
  { href: '/batch', label: 'By batch' },
  { href: '/resume/builder', label: 'Resume' },
  { href: '/ats-checker', label: 'ATS Checker' },
  { href: '/blog', label: 'Blog' },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <header
      className="sticky top-0 z-50 w-full"
      style={{
        paddingTop: 'max(0.75rem, env(safe-area-inset-top))',
        paddingLeft: 'max(0.75rem, env(safe-area-inset-left))',
        paddingRight: 'max(0.75rem, env(safe-area-inset-right))',
      }}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-5xl items-center justify-between gap-3 rounded-2xl border px-3 py-2 backdrop-blur-md sm:px-4"
        style={{ background: 'var(--paper-nav)', borderColor: 'var(--line-strong)' }}
      >
        <Link href="/" aria-label="InternFlow home" className="flex-none">
          <Logo />
        </Link>

        <ul className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="rounded-md px-3 py-2 text-sm transition hover:bg-[var(--paper-dim)]"
                style={{ color: 'var(--ink-soft)' }}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost hidden !py-2 text-sm sm:inline-flex">
            Log in
          </Link>
          <Link href="/register" className="btn btn-primary !py-2 text-sm whitespace-nowrap">
            Get started free
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="btn btn-ghost !px-2 lg:hidden"
            style={{ minWidth: 44, minHeight: 44 }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {open ? (
                <>
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </>
              ) : (
                <>
                  <line x1="3" y1="7" x2="21" y2="7" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="17" x2="21" y2="17" />
                </>
              )}
            </svg>
          </button>
        </div>
      </nav>

      {open && (
        <div
          className="mx-auto mt-2 max-w-5xl rounded-2xl border p-3 lg:hidden"
          style={{ background: 'var(--paper)', borderColor: 'var(--line-strong)' }}
        >
          <ul className="grid grid-cols-2 gap-1">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-sm"
                  style={{ color: 'var(--ink)' }}
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="col-span-2 border-t pt-2" style={{ borderColor: 'var(--line)' }}>
              <Link href="/login" onClick={() => setOpen(false)} className="block rounded-md px-3 py-3 text-sm" style={{ color: 'var(--ink)' }}>
                Log in
              </Link>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import Footer from './Footer';
import PageTransition from './PageTransition';
import { useAuth } from '@/lib/auth';

const sections = [
  { href: '/about',          label: 'About' },
  { href: '/github',         label: 'Code review' },
  { href: '/jobs',           label: 'Jobs' },
  { href: '/internships',    label: 'Internships' },
  { href: '/remote-jobs',    label: 'Remote' },
  { href: '/government-jobs', label: 'Government' },
  { href: '/hackathons',     label: 'Hackathons' },
  { href: '/resume/builder', label: 'Resume' },
  { href: '/linkedin',       label: 'LinkedIn' },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia(
      '(prefers-color-scheme: dark)'
    ).matches;

    const isDark = stored === 'dark' || (!stored && prefersDark);

    setDark(isDark);

    document.documentElement.setAttribute(
      'data-theme',
      isDark ? 'dark' : 'light'
    );
  }, []);

  const toggle = () => {
    const next = !dark;

    setDark(next);

    document.documentElement.setAttribute(
      'data-theme',
      next ? 'dark' : 'light'
    );

    localStorage.setItem('theme', next ? 'dark' : 'light');
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="btn btn-ghost !px-2 !py-1.5 transition-transform duration-150 hover:scale-110 active:scale-95"
    >
      {dark ? (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>
      ) : (
        <svg
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="shell">
      <header
        className={`glass-nav sticky top-0 z-40 border-b ${scrolled ? 'is-scrolled' : ''}`}
        style={{ borderColor: 'var(--line)' }}
      >
        <div className="container-xl flex h-14 items-center justify-between gap-3">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" aria-label="Go to dashboard">
              <Logo />
            </Link>

            <nav
              className="hidden items-center gap-5 md:flex"
              aria-label="Main navigation"
            >
              {sections.map((s) => {
                const active = pathname?.startsWith(s.href);

                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="nav-link relative pb-1 text-sm"
                    style={
                      active
                        ? {
                            color: 'var(--ink)',
                            fontWeight: 600,
                          }
                        : undefined
                    }
                    aria-current={active ? 'page' : undefined}
                  >
                    {s.label}

                    {active && (
                      <span
                        className="absolute -bottom-[1px] left-0 h-[2px] w-full rounded-full"
                        style={{ background: 'var(--indigo)' }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />

            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="btn btn-primary text-sm hidden sm:inline-flex"
                >
                  Dashboard
                </Link>

                {!user.is_guest && (
                  <button
                    onClick={logout}
                    className="btn btn-ghost !px-2 !py-1 text-sm hidden sm:inline-flex"
                  >
                    Sign out
                  </button>
                )}
              </>
            ) : (
              <Link
                href="/login"
                className="btn btn-secondary text-sm hidden sm:inline-flex"
              >
                Sign in
              </Link>
            )}

            <button
              className="btn btn-ghost !px-2 !py-1.5 md:hidden"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((v) => !v)}
            >
              {mobileOpen ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              ) : (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div
            className="border-t md:hidden"
            style={{
              borderColor: 'var(--line)',
              background: 'var(--paper)',
              animation: 'reveal-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <nav
              className="container-xl flex flex-col py-3"
              aria-label="Mobile navigation"
            >
              {sections.map((s) => {
                const active = pathname?.startsWith(s.href);

                return (
                  <Link
                    key={s.href}
                    href={s.href}
                    className="rounded-[var(--radius-sm)] px-3 py-3 text-sm font-medium"
                    style={{
                      color: active ? 'var(--indigo)' : 'var(--ink)',
                      background: active
                        ? 'var(--indigo-soft)'
                        : 'transparent',
                    }}
                    aria-current={active ? 'page' : undefined}
                  >
                    {s.label}
                  </Link>
                );
              })}

              <div
                className="mt-2 border-t pt-3 flex items-center justify-between"
                style={{ borderColor: 'var(--line)' }}
              >
                {user && !user.is_guest && (
                  <span
                    className="eyebrow truncate max-w-[200px] px-3"
                    title={user.email}
                  >
                    {user.email}
                  </span>
                )}

                {user ? (
                  <div className="ml-auto flex items-center gap-2">
                    <Link
                      href="/dashboard"
                      className="btn btn-primary text-sm"
                    >
                      Dashboard
                    </Link>

                    {!user.is_guest && (
                      <button
                        onClick={logout}
                        className="btn btn-ghost !px-3 !py-2 text-sm"
                      >
                        Sign out
                      </button>
                    )}
                  </div>
                ) : (
                  <Link
                    href="/login"
                    className="btn btn-secondary text-sm ml-auto"
                  >
                    Sign in
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      <main className="container-xl flex-1 py-8 sm:py-10">
        <PageTransition>{children}</PageTransition>
      </main>

      <Footer />
    </div>
  );
}
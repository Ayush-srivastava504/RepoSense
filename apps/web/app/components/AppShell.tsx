// Module: app/components/AppShell.tsx
// Defines component(s)/export(s): AppShell

'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from './Logo';
import Footer from './Footer';
import PageTransition from './PageTransition';
import Sidebar from './Sidebar';
import { LanguageProvider } from '@/i18n/LanguageContext';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <LanguageProvider>
      <div className="app-frame">
        {mobileOpen && (
          <div
            className="sidebar-backdrop lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}

        <Sidebar mobileOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        <div className="main-column">
          <header
            className="flex h-14 flex-none items-center justify-between gap-3 border-b px-4 lg:hidden"
            style={{ borderColor: 'var(--line)', background: 'var(--paper-nav)' }}
          >
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
              className="btn btn-ghost !px-2 !py-1.5"
            >
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
            </button>

            <Link href="/dashboard" aria-label="Go to dashboard">
              <Logo />
            </Link>

            <Link href="/dashboard" aria-label="Dashboard" className="btn btn-ghost !px-2 !py-1.5">
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
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1" />
              </svg>
            </Link>
          </header>

          <main className="container-xl flex-1 py-8 sm:py-10">
            <PageTransition>{children}</PageTransition>
          </main>

          <Footer />
        </div>
      </div>
    </LanguageProvider>
  );
}

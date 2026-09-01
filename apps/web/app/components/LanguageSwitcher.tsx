'use client';

import { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { i18n, localeNames, localeFlags, type Locale } from '@/i18n/config';

export default function LanguageSwitcher() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Locale>('en');
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    // Detect current locale from cookie or URL
    const cookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('NEXT_LOCALE='));
    if (cookie) {
      const val = cookie.split('=')[1] as Locale;
      if (i18n.locales.includes(val)) setCurrent(val);
    } else {
      // Check URL prefix
      const segment = pathname.split('/')[1];
      if (i18n.locales.includes(segment as Locale)) {
        setCurrent(segment as Locale);
      }
    }
  }, [pathname]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const switchLocale = (locale: Locale) => {
    // Set cookie for middleware
    document.cookie = `NEXT_LOCALE=${locale};path=/;max-age=31536000;SameSite=Lax`;
    setCurrent(locale);
    setOpen(false);

    // Build new path
    let newPath = pathname;

    // Remove existing locale prefix if present
    const currentSegment = pathname.split('/')[1];
    if (i18n.locales.includes(currentSegment as Locale)) {
      newPath = pathname.slice(currentSegment.length + 1) || '/';
    }

    // Add locale prefix for non-default
    if (locale !== i18n.defaultLocale) {
      newPath = `/${locale}${newPath === '/' ? '' : newPath}`;
    }

    window.location.href = newPath;
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="sidebar-link w-full !text-left"
        aria-label="Change language"
        aria-expanded={open}
      >
        <span className="text-base flex-none">{localeFlags[current]}</span>
        <span className="flex-1">{localeNames[current]}</span>
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="flex-none transition-transform duration-150"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute bottom-full left-0 mb-1 w-full rounded-lg border shadow-lg z-50 max-h-64 overflow-y-auto"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--line)',
          }}
        >
          {i18n.locales.map((locale) => (
            <button
              key={locale}
              onClick={() => switchLocale(locale)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm text-left transition-colors hover:bg-[var(--hover)] ${
                current === locale ? 'font-semibold' : ''
              }`}
              style={{ color: 'var(--ink)' }}
            >
              <span className="text-base">{localeFlags[locale]}</span>
              <span>{localeNames[locale]}</span>
              {current === locale && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="ml-auto"
                  style={{ color: 'var(--accent)' }}
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

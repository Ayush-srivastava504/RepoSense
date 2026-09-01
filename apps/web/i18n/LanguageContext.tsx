'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { i18n, type Locale } from './config';

import en from './dictionaries/en.json';
import es from './dictionaries/es.json';
import ja from './dictionaries/ja.json';
import fr from './dictionaries/fr.json';
import de from './dictionaries/de.json';
import pt from './dictionaries/pt.json';
import ko from './dictionaries/ko.json';
import it from './dictionaries/it.json';
import hi from './dictionaries/hi.json';

const dictionaries: Record<Locale, typeof en> = {
  en,
  es,
  ja,
  fr,
  de,
  pt,
  ko,
  it,
  hi,
};

interface LanguageContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  dict: typeof en;
  t: (keyPath: string, fallback?: string) => any;
}

const LanguageContext = createContext<LanguageContextType>({
  locale: 'en',
  setLocale: () => {},
  dict: en,
  t: (keyPath: string, fallback?: string) => fallback || keyPath,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');
  const pathname = usePathname();

  useEffect(() => {
    // 1. Detect from cookie
    const cookie = document.cookie
      .split('; ')
      .find((c) => c.startsWith('NEXT_LOCALE='));
    let detectedLocale: Locale | null = null;

    if (cookie) {
      const val = cookie.split('=')[1] as Locale;
      if (i18n.locales.includes(val)) {
        detectedLocale = val;
      }
    }

    // 2. Or detect from URL pathname
    if (!detectedLocale && pathname) {
      const segment = pathname.split('/')[1] as Locale;
      if (i18n.locales.includes(segment)) {
        detectedLocale = segment;
      }
    }

    // 3. Or detect from navigator.language
    if (!detectedLocale && typeof navigator !== 'undefined') {
      const browserLang = navigator.language.slice(0, 2) as Locale;
      if (i18n.locales.includes(browserLang)) {
        detectedLocale = browserLang;
      }
    }

    if (detectedLocale && detectedLocale !== locale) {
      setLocaleState(detectedLocale);
      document.documentElement.lang = detectedLocale;
    }
  }, [pathname]);

  const setLocale = (newLocale: Locale) => {
    if (!i18n.locales.includes(newLocale)) return;
    setLocaleState(newLocale);
    document.cookie = `NEXT_LOCALE=${newLocale};path=/;max-age=31536000;SameSite=Lax`;
    document.documentElement.lang = newLocale;
  };

  const dict = dictionaries[locale] || en;

  const t = (keyPath: string, fallback?: string) => {
    const keys = keyPath.split('.');
    let current: any = dict;
    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        // Fallback to English dictionary
        let enCurrent: any = en;
        for (const enKey of keys) {
          if (enCurrent && typeof enCurrent === 'object' && enKey in enCurrent) {
            enCurrent = enCurrent[enKey];
          } else {
            return fallback || keyPath;
          }
        }
        return enCurrent;
      }
    }
    return current;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, dict, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}

export function useTranslation() {
  const { t, locale, dict, setLocale } = useContext(LanguageContext);
  return { t, locale, dict, setLocale };
}

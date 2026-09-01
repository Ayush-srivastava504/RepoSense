import type { Locale } from './config';

// Lazy-load dictionaries to keep bundle size small
const dictionaries = {
  en: () => import('./dictionaries/en.json').then((m) => m.default),
  es: () => import('./dictionaries/es.json').then((m) => m.default),
  ja: () => import('./dictionaries/ja.json').then((m) => m.default),
  fr: () => import('./dictionaries/fr.json').then((m) => m.default),
  de: () => import('./dictionaries/de.json').then((m) => m.default),
  pt: () => import('./dictionaries/pt.json').then((m) => m.default),
  ko: () => import('./dictionaries/ko.json').then((m) => m.default),
  it: () => import('./dictionaries/it.json').then((m) => m.default),
  hi: () => import('./dictionaries/hi.json').then((m) => m.default),
};

export const getDictionary = async (locale: Locale) => {
  return dictionaries[locale]();
};

export type Dictionary = Awaited<ReturnType<typeof getDictionary>>;

// i18n configuration — supported locales and default locale
export const i18n = {
  defaultLocale: 'en' as const,
  locales: ['en', 'es', 'ja', 'fr', 'de', 'pt', 'ko', 'it', 'hi'] as const,
};

export type Locale = (typeof i18n)['locales'][number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  es: 'Español',
  ja: '日本語',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ko: '한국어',
  it: 'Italiano',
  hi: 'हिन्दी',
};

export const localeFlags: Record<Locale, string> = {
  en: '🇺🇸',
  es: '🇪🇸',
  ja: '🇯🇵',
  fr: '🇫🇷',
  de: '🇩🇪',
  pt: '🇧🇷',
  ko: '🇰🇷',
  it: '🇮🇹',
  hi: '🇮🇳',
};

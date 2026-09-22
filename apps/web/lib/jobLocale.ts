// Module: lib/jobLocale.ts
// Defines function(s): resolveJobLocale, jobLanguageAlternates
//
// Small shared helper so the four job-detail routes (jobs/internships/
// remote-jobs/government-jobs [slug]) don't each re-implement the same
// locale-resolution and hreflang-building logic. Job content translation
// is scoped to TRANSLATABLE_LOCALES (es + pt as of Session 6,
// IMPLEMENTATION_PLAN.md §7) — a request for any other configured locale
// (ja/fr/de/ko/it/hi) simply gets English content back, same as before
// this pipeline existed, since GET /api/jobs/{id}?locale=xx only swaps
// content when a job_translations row actually exists for that locale.

import { jobHreflangLinks, TRANSLATABLE_LOCALES } from './hreflang';
import { getJobById, type Job } from './jobs';

/** Same 'x-locale' header (set by middleware.ts) / 'NEXT_LOCALE' cookie
 * fallback chain the blog pages already use, so job pages resolve the
 * request's locale the same way the rest of the site does.
 *
 * 'next/headers' is imported dynamically, only inside this function, so
 * merely importing this module (as tests/job-locale.test.ts does, for the
 * pure helpers below) never triggers Node to resolve the 'next' package.
 * The web unit-test CI step runs `tsx --test` without an `npm install`
 * step, so a static top-level import here would fail module resolution
 * even for tests that never call this function. */
export async function resolveJobLocale(): Promise<string> {
    const { headers, cookies } = await import('next/headers');
    return headers().get('x-locale') || cookies().get('NEXT_LOCALE')?.value || 'en';
}

/** Record<lang, href> for a job's alternates.languages, or {} when the job
 * has no translations at all — mirrors languageAlternates() in
 * structuredData.ts but keyed off the job's own translated_locales rather
 * than the site-wide (currently disabled) hreflang flag. */
export function jobLanguageAlternates(path: string, translatedLocales: string[] | undefined): Record<string, string> {
    return Object.fromEntries(jobHreflangLinks(path, translatedLocales ?? []).map((l) => [l.lang, l.href]));
}

export interface JobLocaleContent {
    job: Job | null;
    locale: string;
    // True when `locale` isn't English AND this specific job has a real
    // job_translations row for it — i.e. `job` above actually contains
    // translated title/overview/structured_description, so the page
    // should self-canonicalize to its own /{locale}/... URL rather than
    // the English one. Every other case (no translation for this job, or
    // a locale outside TRANSLATABLE_LOCALES) stays on the English
    // canonical, same as before this pipeline existed.
    isTranslated: boolean;
}

/** Fetches a job, translated into the current request's locale when a translation exists for it. */
export async function getLocalizedJob(id: string): Promise<JobLocaleContent> {
    const locale = await resolveJobLocale();
    const wantsTranslation = locale !== 'en' && TRANSLATABLE_LOCALES.includes(locale);
    const job = await getJobById(id, wantsTranslation ? locale : undefined);
    const isTranslated = wantsTranslation && Boolean(job?.translated_locales?.includes(locale));
    return { job, locale, isTranslated };
}

/** Locale-prefixed path when this response is genuinely translated content, else the plain English path. */
export function localizedCanonicalPath(path: string, content: JobLocaleContent): string {
    return content.isTranslated ? `/${content.locale}${path}` : path;
}

// Module: lib/jobContent.ts
// How much text on a job page is unique to that job, and whether it clears the 1,500-word bar.
//
// Only job-specific text counts: the long-form article (job_article_service.py), the AI overview and the
// listing's own description. Site template text (checklists, timelines, related links) is the same on every
// job page, so it never counts toward the bar.
//
// The bar decides sitemap inclusion and listing priority only. Job pages are never noindexed: a page under
// the bar stays live, linked and indexable, and joins the sitemap once its article is published.
// Keep JOB_MIN_UNIQUE_WORDS in sync with MIN_ARTICLE_WORDS in services/api/src/services/sitemap_builder.py.
import type { Job, JobArticle } from './jobs';

export const JOB_MIN_UNIQUE_WORDS = 1500;

const WORD = /[A-Za-z0-9][\w'’+#.-]*/g;

export function countWords(text?: string | null): number {
    return text ? (text.match(WORD) ?? []).length : 0;
}

export function jobArticle(job: Pick<Job, 'enriched_sections'>): JobArticle | null {
    const a = job.enriched_sections?.article;
    return a && Array.isArray(a.sections) && a.sections.length > 0 ? a : null;
}

export function articleWordCount(article: JobArticle): number {
    const body = article.sections.reduce((n, s) => n + s.paragraphs.reduce((m, p) => m + countWords(p), 0), 0);
    return body + (article.faqs ?? []).reduce((n, f) => n + countWords(f.q) + countWords(f.a), 0);
}

/** Words of the published article: counted from the text when the article is present, else the API's count. */
export function jobArticleWords(job: Pick<Job, 'enriched_sections' | 'article_words'>): number {
    const a = jobArticle(job);
    return a ? articleWordCount(a) : (job.article_words ?? 0);
}

/** True once the job carries a published article of at least JOB_MIN_UNIQUE_WORDS words. */
export function hasFullJobContent(job: Pick<Job, 'enriched_sections' | 'article_words'>): boolean {
    return jobArticleWords(job) >= JOB_MIN_UNIQUE_WORDS;
}

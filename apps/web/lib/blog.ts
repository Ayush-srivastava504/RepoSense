// Module: lib/blog.ts
// Defines component(s)/export(s): BLOG_DIR, getAllPosts, getPostBySlug, getPostsByCategory, getAllCategories, getLocalizedSlugList
// Defines type(s): BlogPost

import fs from 'fs';
import path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface SeoMetadata {
  metaTitle?: string;
  metaDescription?: string;
  canonicalUrl?: string;
  /** Raw robots directive as authored, e.g. "index, follow" or "noindex, nofollow" */
  robots?: string;
}

export interface ChartSeries {
  name: string;
  data: number[];
}

export interface ChartDefinition {
  type: 'bar' | 'line' | 'pie' | string;
  title: string;
  description?: string;
  dataSource?: string;
  xAxis?: string[];
  series: ChartSeries[];
}

/**
 * A body section is mostly free-form beyond id/title/content — different
 * sections attach different "extra" shapes (a skill graph, a comparison
 * table, a list of paths, etc). We type the ones we know how to render and
 * fall back to rendering nothing extra for shapes we don't recognize yet,
 * rather than guessing at markup for unknown data.
 */
export interface BodySection {
  id: string;
  title: string;
  content: string;
  graph?: {
    root: string;
    nodes: { name: string; skills: string[] }[];
  };
  examples?: { cluster: string; skills: string[] }[];
  comparison?: { level: string; typicalFocus: string[] }[];
  salaryDimensions?: string[];
  signals?: string[];
  paths?: { startingRole: string; bridgeSkills: string[] }[];
}

export interface StructuredBody {
  introduction: string;
  sections: BodySection[];
}

export interface HeroBlock {
  eyebrow?: string;
  headline?: string;
  summary?: string;
  dataSource?: string;
  lastUpdated?: string;
}

export interface MethodologyBlock {
  title: string;
  details: string;
  importantNote?: string;
}

export interface RealWorldExampleBlock {
  title: string;
  context: string;
  workflow: string[];
}

export interface InternalLink {
  anchorText: string;
  url: string;
}

export interface CtaBlock {
  title: string;
  description: string;
  buttonText: string;
  url: string;
}

export interface InteractiveFilter {
  filterName: string;
  options: string[];
}

export interface DataExplorerBlock {
  title: string;
  description: string;
  filters: string[];
  cta: string;
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  category: string;
  publishedAt: string;
  updatedAt?: string;
  author?: {
    name: string;
    role: string;
    avatar?: string;
  };
  readingTime?: string;
  image?: {
    url: string;
    alt: string;
    width?: number;
    height?: number;
  };
  tags?: string[];
  /**
   * Plain markdown-ish string for the 46 existing articles, or a
   * StructuredBody for the newer data-driven article format. Keeping this a
   * union (rather than migrating body to an object) means none of the
   * existing plain-string articles need to change.
   */
  body: string | StructuredBody;
  faq?: {
    q: string;
    a: string;
  }[];

  // Fields used by the newer, data-driven article format. All optional so
  // plain articles are unaffected.
  seoMetadata?: SeoMetadata;
  hero?: HeroBlock;
  keyTakeaways?: string[];
  charts?: ChartDefinition[];
  methodology?: MethodologyBlock;
  realWorldExample?: RealWorldExampleBlock;
  internalLinks?: InternalLink[];
  cta?: CtaBlock;
  interactiveFilters?: InteractiveFilter[];
  dataExplorer?: DataExplorerBlock;
}

/** Narrows body to StructuredBody. Use this instead of duck-typing inline. */
export function isStructuredBody(body: BlogPost['body']): body is StructuredBody {
  return typeof body === 'object' && body !== null && 'sections' in body;
}

/** Word count across the rendered body text, for Article schema's wordCount. */
export function articleWordCount(body: BlogPost['body']): number {
  const text = isStructuredBody(body)
    ? [body.introduction, ...body.sections.map((s) => s.content)].join(' ')
    : body;
  const words = text.trim().split(/\s+/).filter(Boolean);
  return words.length;
}

function isValidDate(value: unknown): boolean {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime());
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks the required fields and internal consistency of one article's data.
 * Returns hard `errors` (bad enough that the page would be broken or
 * unindexable — these fail the build) and soft `warnings` (worth fixing but
 * already handled gracefully at render time, e.g. an empty chart).
 */
export function validateBlogPost(post: Partial<BlogPost>, filename: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const label = filename;

  const expectedSlug = filename.replace(/\.json$/, '');
  if (!post.slug || post.slug.trim() === '') {
    errors.push(`${label}: missing slug`);
  } else if (post.slug !== expectedSlug) {
    errors.push(`${label}: slug "${post.slug}" does not match filename (expected "${expectedSlug}")`);
  }

  if (!post.title || post.title.trim() === '') errors.push(`${label}: missing/empty title`);
  if (!post.description || post.description.trim() === '') errors.push(`${label}: missing/empty description`);
  if (!post.keyword || post.keyword.trim() === '') errors.push(`${label}: missing/empty keyword`);
  if (!post.category || post.category.trim() === '') errors.push(`${label}: missing/empty category`);

  if (!post.publishedAt) {
    errors.push(`${label}: missing publishedAt`);
  } else if (!isValidDate(post.publishedAt)) {
    errors.push(`${label}: invalid publishedAt "${post.publishedAt}"`);
  }
  if (post.updatedAt && !isValidDate(post.updatedAt)) {
    errors.push(`${label}: invalid updatedAt "${post.updatedAt}"`);
  }

  if (post.body == null || post.body === '') {
    errors.push(`${label}: missing/empty body`);
  } else if (isStructuredBody(post.body)) {
    if (!post.body.introduction || post.body.introduction.trim() === '') {
      errors.push(`${label}: structured body missing introduction`);
    }
    if (!Array.isArray(post.body.sections) || post.body.sections.length === 0) {
      errors.push(`${label}: structured body has no sections`);
    } else {
      post.body.sections.forEach((section, i) => {
        if (!section.id) errors.push(`${label}: body.sections[${i}] missing id`);
        if (!section.title) errors.push(`${label}: body.sections[${i}] missing title`);
        if (!section.content) errors.push(`${label}: body.sections[${i}] missing content`);
      });
    }
  }

  if (post.faq) {
    post.faq.forEach((f, i) => {
      if (!f.q || !f.q.trim()) errors.push(`${label}: faq[${i}] missing question`);
      if (!f.a || !f.a.trim()) errors.push(`${label}: faq[${i}] missing answer`);
    });
  }

  if (post.seoMetadata?.canonicalUrl && !isValidUrl(post.seoMetadata.canonicalUrl)) {
    errors.push(`${label}: seoMetadata.canonicalUrl is not a valid URL: "${post.seoMetadata.canonicalUrl}"`);
  }

  if (post.charts) {
    post.charts.forEach((chart) => {
      const hasData = chart.series.some((s) => s.data.length > 0);
      if (!hasData) {
        warnings.push(`${label}: chart "${chart.title}" has no data — rendered without its chart body until populated`);
      }
    });
  }

  return { errors, warnings };
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getBlogDir(locale?: string): string {
  if (locale && locale !== 'en') {
    const localeDir = path.join(BLOG_DIR, locale);
    if (fs.existsSync(localeDir)) {
      return localeDir;
    }
  }
  return BLOG_DIR;
}

function readAndValidatePost(dir: string, filename: string): BlogPost {
  const raw = fs.readFileSync(path.join(dir, filename), 'utf-8');
  const post = JSON.parse(raw) as BlogPost;
  const { errors, warnings } = validateBlogPost(post, filename);
  if (errors.length > 0) {
    throw new Error(`Invalid blog article ${filename}:\n  - ${errors.join('\n  - ')}`);
  }
  warnings.forEach((w) => console.warn(`[blog validation] ${w}`));
  return post;
}

export function getAllPosts(locale?: string): BlogPost[] {
  const dir = getBlogDir(locale);
  ensureDir(dir);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !fs.statSync(path.join(dir, f)).isDirectory());
  
  // If locale directory is empty or missing, fallback to English
  if (files.length === 0 && dir !== BLOG_DIR) {
    const enFiles = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json') && !fs.statSync(path.join(BLOG_DIR, f)).isDirectory());
    return enFiles
      .map((f) => readAndValidatePost(BLOG_DIR, f))
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  const posts = files.map((f) => readAndValidatePost(dir, f));

  return posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string, locale?: string): BlogPost | null {
  const dir = getBlogDir(locale);
  ensureDir(dir);

  let file = path.join(dir, `${slug}.json`);
  let readDir = dir;
  if (!fs.existsSync(file) && dir !== BLOG_DIR) {
    // Fallback to English
    file = path.join(BLOG_DIR, `${slug}.json`);
    readDir = BLOG_DIR;
  }

  if (!fs.existsSync(file)) return null;
  return readAndValidatePost(readDir, `${slug}.json`);
}

export function getPostsByCategory(category: string, locale?: string): BlogPost[] {
  return getAllPosts(locale).filter((p) => p.category === category);
}

export function getAllCategories(locale?: string): string[] {
  const posts = getAllPosts(locale);
  const categories = new Set(posts.map((p) => p.category));
  return Array.from(categories);
}

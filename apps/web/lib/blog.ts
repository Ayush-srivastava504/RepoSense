// Module: lib/blog.ts
// Defines component(s)/export(s): BLOG_DIR, getAllPosts, getPostBySlug, getPostsByCategory, getAllCategories, getLocalizedSlugList
// Defines type(s): BlogPost

import fs from 'fs';
import path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

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
  body: string;
  faq?: {
    q: string;
    a: string;
  }[];
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

export function getAllPosts(locale?: string): BlogPost[] {
  const dir = getBlogDir(locale);
  ensureDir(dir);

  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !fs.statSync(path.join(dir, f)).isDirectory());
  
  // If locale directory is empty or missing, fallback to English
  if (files.length === 0 && dir !== BLOG_DIR) {
    const enFiles = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json') && !fs.statSync(path.join(BLOG_DIR, f)).isDirectory());
    return enFiles.map((f) => {
      const raw = fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8');
      return JSON.parse(raw) as BlogPost;
    }).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
    return JSON.parse(raw) as BlogPost;
  });

  return posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string, locale?: string): BlogPost | null {
  const dir = getBlogDir(locale);
  ensureDir(dir);

  let file = path.join(dir, `${slug}.json`);
  if (!fs.existsSync(file) && dir !== BLOG_DIR) {
    // Fallback to English
    file = path.join(BLOG_DIR, `${slug}.json`);
  }

  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as BlogPost;
}

export function getPostsByCategory(category: string, locale?: string): BlogPost[] {
  return getAllPosts(locale).filter((p) => p.category === category);
}

export function getAllCategories(locale?: string): string[] {
  const posts = getAllPosts(locale);
  const categories = new Set(posts.map((p) => p.category));
  return Array.from(categories);
}

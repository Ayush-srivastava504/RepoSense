import fs from 'fs';
import path from 'path';

const BLOG_DIR = path.join(process.cwd(), 'content', 'blog');

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  keyword: string;
  category: string;
  publishedAt: string; // ISO date
  updatedAt?: string;
  body: string; // markdown-ish, rendered with simple formatter
  faq?: { q: string; a: string }[];
}

function ensureDir() {
  if (!fs.existsSync(BLOG_DIR)) {
    fs.mkdirSync(BLOG_DIR, { recursive: true });
  }
}

export function getAllPosts(): BlogPost[] {
  ensureDir();
  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json'));
  const posts = files.map((f) => {
    const raw = fs.readFileSync(path.join(BLOG_DIR, f), 'utf-8');
    return JSON.parse(raw) as BlogPost;
  });
  return posts.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  ensureDir();
  const file = path.join(BLOG_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as BlogPost;
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

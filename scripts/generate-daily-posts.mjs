#!/usr/bin/env node
/**
 * Generates N new SEO-targeted blog posts from the keyword queue and writes
 * them as JSON files under apps/web/content/blog/. Meant to run on a daily
 * schedule (see .github/workflows/daily-seo-content.yml).
 *
 * Usage:
 *   node scripts/generate-daily-posts.mjs            # 1 post
 *   node scripts/generate-daily-posts.mjs --count 3   # 3 posts
 *
 * If ANTHROPIC_API_KEY is set in the environment, posts are drafted by
 * calling the Claude API for genuinely unique, higher-quality copy. If no
 * key is present, a structured template generator is used instead so the
 * pipeline still works out of the box.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const WEB_DIR = path.join(ROOT, 'apps', 'web');
const KEYWORDS_PATH = path.join(WEB_DIR, 'content', 'seo', 'keywords.json');
const BLOG_DIR = path.join(WEB_DIR, 'content', 'blog');

const args = process.argv.slice(2);
const countFlagIdx = args.indexOf('--count');
const COUNT = countFlagIdx !== -1 ? parseInt(args[countFlagIdx + 1], 10) : 1;

function slugify(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
}

function loadKeywords() {
  return JSON.parse(fs.readFileSync(KEYWORDS_PATH, 'utf-8'));
}

function saveKeywords(records) {
  fs.writeFileSync(KEYWORDS_PATH, JSON.stringify(records, null, 2));
}

function pickNextKeywords(records, n) {
  const priorityRank = { high: 0, 'medium-high': 1, medium: 2, low: 3 };
  const queued = records
    .filter((r) => r.status === 'queued')
    .sort((a, b) => (priorityRank[a.priority] ?? 9) - (priorityRank[b.priority] ?? 9));
  return queued.slice(0, n);
}

// --- Template-based article generator (no external API required) ---
function buildTemplateArticle(keywordRecord) {
  const { keyword, category } = keywordRecord;
  const title = titleCase(keyword);
  const description = `A practical, no-fluff guide on ${keyword} — what it actually takes, common mistakes, and a clear next step, written for engineering students and early-career job seekers.`;

  const body = [
    `If you're searching for "${keyword}", you're probably trying to solve a real, specific problem this week — not read a wall of generic advice. Here's the short version, then the detail.`,
    `## Why this matters`,
    `${titleCase(category.replace(/-/g, ' '))} decisions compound. A small improvement here — a sharper resume line, a better-timed application, a cleaner GitHub profile — tends to save you weeks of back-and-forth later, because recruiters and applicant tracking systems are both pattern-matching against thousands of near-identical submissions.`,
    `## The core idea`,
    `- Be specific, not impressive-sounding: concrete numbers and outcomes beat adjectives.\n- Match the exact language the posting or platform uses — this is what most ATS and recruiter search tools actually key off.\n- Ship something checkable: a public repo, a live demo, a verifiable certificate, a real reference — not just a claim.`,
    `## A practical next step`,
    `Pick one thing from the list above and fix it today rather than trying to overhaul everything at once. Small, verifiable improvements shipped consistently outperform one large effort that never gets finished.`,
    `## Where InternFlow fits in`,
    `If part of this is about your resume, GitHub profile, or LinkedIn presence, InternFlow's free tools (ATS resume checker, GitHub README generator, and AI code review) are built to shortcut exactly this kind of work — check the tools hub and run your profile through one of them in a couple of minutes.`,
  ].join('\n\n');

  const faq = [
    {
      q: `Is ${keyword} something I can realistically do without prior experience?`,
      a: `Yes — most of what matters here is presentation and consistency, not prior credentials. Start small, document what you do, and iterate.`,
    },
    {
      q: `How long does it usually take to see results?`,
      a: `For most students, focused effort over 2–4 weeks (a few hours a week) is enough to see a measurable difference in response rates or outcomes.`,
    },
  ];

  return { title, description, body, faq };
}

function titleCase(str) {
  return str
    .split(' ')
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ')
    .replace(/^./, (c) => c.toUpperCase());
}

async function buildAiArticle(keywordRecord) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const prompt = `Write a genuinely useful, non-generic SEO blog post (500-700 words) for engineering students, targeting the search keyword "${keywordRecord.keyword}" (category: ${keywordRecord.category}). This is for InternFlow, a platform helping students land internships with AI resume/ATS/GitHub tools.
Return ONLY valid JSON, no markdown fences, no preamble, in this exact shape:
{"title": "...", "description": "...(under 160 chars, includes the keyword naturally)", "body": "...(use \\n\\n between paragraphs, ## for 2-3 subheadings, - bullets where useful, specific and concrete, no fluff, no fake statistics)", "faq": [{"q": "...", "a": "..."}, {"q": "...", "a": "..."}]}`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1800,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`API error ${res.status}`);
    const data = await res.json();
    const text = data.content.map((b) => b.text || '').join('');
    const clean = text.replace(/```json|```/g, '').trim();
    return JSON.parse(clean);
  } catch (err) {
    console.error('AI generation failed, falling back to template:', err.message);
    return null;
  }
}

async function main() {
  if (!fs.existsSync(BLOG_DIR)) fs.mkdirSync(BLOG_DIR, { recursive: true });

  const records = loadKeywords();
  const batch = pickNextKeywords(records, COUNT);

  if (batch.length === 0) {
    console.log('No queued keywords left — add more to content/seo/keywords.json.');
    return;
  }

  const now = new Date().toISOString();
  const written = [];

  for (const kwRecord of batch) {
    const slug = slugify(kwRecord.keyword) + '-' + kwRecord.id;
    const ai = await buildAiArticle(kwRecord);
    const article = ai || buildTemplateArticle(kwRecord);

    const post = {
      slug,
      title: article.title,
      description: article.description,
      keyword: kwRecord.keyword,
      category: kwRecord.category,
      publishedAt: now,
      body: article.body,
      faq: article.faq,
    };

    fs.writeFileSync(path.join(BLOG_DIR, `${slug}.json`), JSON.stringify(post, null, 2));

    kwRecord.status = 'published';
    kwRecord.publishedSlug = slug;
    kwRecord.publishedAt = now;

    written.push(slug);
  }

  saveKeywords(records);
  console.log(`Published ${written.length} post(s):\n- ${written.join('\n- ')}`);
}

main();

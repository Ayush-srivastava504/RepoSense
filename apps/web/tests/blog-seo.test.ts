// Run: npx --yes tsx --test tests/blog-seo.test.ts   (node:test via tsx, no extra deps)
//
// SEO plan Phase 8 item 29 — automated regression tests so a broken article
// or a metadata regression fails CI instead of shipping a weak page
// silently. Covers the two places that actually decide what search engines
// see: lib/blog.ts's validateBlogPost (build-time content gate) and
// app/blog/[slug]/page.tsx's parseRobotsDirective (robots meta mapping).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateBlogPost, articleWordCount, isStructuredBody, type BlogPost } from '../lib/blog';
import { parseRobotsDirective } from '../lib/seo/robots';

const BLOG_DIR = resolve(__dirname, '..', 'content', 'blog');

function basePost(overrides: Partial<BlogPost> = {}): Partial<BlogPost> {
  return {
    slug: 'example-post',
    title: 'Example Post',
    description: 'An example post for testing.',
    keyword: 'example',
    category: 'guides',
    publishedAt: '2026-01-01',
    body: 'Some content.',
    ...overrides,
  };
}

// ---------- validateBlogPost: required fields ----------
test('validateBlogPost: flags missing title/description/keyword/category/body', () => {
  const { errors } = validateBlogPost({ slug: 'x', publishedAt: '2026-01-01' }, 'x.json');
  assert.ok(errors.some((e) => e.includes('missing/empty title')));
  assert.ok(errors.some((e) => e.includes('missing/empty description')));
  assert.ok(errors.some((e) => e.includes('missing/empty keyword')));
  assert.ok(errors.some((e) => e.includes('missing/empty category')));
  assert.ok(errors.some((e) => e.includes('missing/empty body')));
});

test('validateBlogPost: slug must match filename', () => {
  const { errors } = validateBlogPost(basePost({ slug: 'wrong-slug' }), 'example-post.json');
  assert.ok(errors.some((e) => e.includes('does not match filename')));
});

test('validateBlogPost: rejects invalid publishedAt/updatedAt', () => {
  const { errors } = validateBlogPost(basePost({ publishedAt: 'not-a-date' }), 'example-post.json');
  assert.ok(errors.some((e) => e.includes('invalid publishedAt')));

  const { errors: errors2 } = validateBlogPost(
    basePost({ updatedAt: '13/40/2026' }),
    'example-post.json'
  );
  assert.ok(errors2.some((e) => e.includes('invalid updatedAt')));
});

test('validateBlogPost: rejects an invalid seoMetadata.canonicalUrl', () => {
  const { errors } = validateBlogPost(
    basePost({ seoMetadata: { canonicalUrl: 'not a url' } }),
    'example-post.json'
  );
  assert.ok(errors.some((e) => e.includes('canonicalUrl is not a valid URL')));
});

test('validateBlogPost: accepts a valid canonicalUrl', () => {
  const { errors } = validateBlogPost(
    basePost({ seoMetadata: { canonicalUrl: 'https://intern-flow.in/blog/example-post' } }),
    'example-post.json'
  );
  assert.equal(errors.some((e) => e.includes('canonicalUrl')), false);
});

// ---------- validateBlogPost: structured body ----------
test('validateBlogPost: structured body requires introduction and non-empty sections', () => {
  const { errors } = validateBlogPost(
    basePost({ body: { introduction: '', sections: [] } }),
    'example-post.json'
  );
  assert.ok(errors.some((e) => e.includes('missing introduction')));
  assert.ok(errors.some((e) => e.includes('has no sections')));
});

test('validateBlogPost: structured body sections need id/title/content', () => {
  const { errors } = validateBlogPost(
    basePost({
      body: {
        introduction: 'Intro.',
        sections: [{ id: '', title: '', content: '' } as any],
      },
    }),
    'example-post.json'
  );
  assert.ok(errors.some((e) => e.includes('sections[0] missing id')));
  assert.ok(errors.some((e) => e.includes('sections[0] missing title')));
  assert.ok(errors.some((e) => e.includes('sections[0] missing content')));
});

test('validateBlogPost: a well-formed structured body passes', () => {
  const { errors } = validateBlogPost(
    basePost({
      body: {
        introduction: 'Intro.',
        sections: [{ id: 'sec-1', title: 'Section 1', content: 'Content.' }],
      },
    }),
    'example-post.json'
  );
  assert.deepEqual(errors, []);
});

// ---------- validateBlogPost: FAQ ----------
test('validateBlogPost: faq entries need both a question and an answer', () => {
  const { errors } = validateBlogPost(
    basePost({ faq: [{ q: '', a: 'An answer' }, { q: 'A question', a: '' }] }),
    'example-post.json'
  );
  assert.ok(errors.some((e) => e.includes('faq[0] missing question')));
  assert.ok(errors.some((e) => e.includes('faq[1] missing answer')));
});

// ---------- validateBlogPost: charts (soft warning, not a build failure) ----------
test('validateBlogPost: an empty chart is a warning, not an error', () => {
  const { errors, warnings } = validateBlogPost(
    basePost({ charts: [{ type: 'bar', title: 'Empty chart', series: [{ name: 'A', data: [] }] }] }),
    'example-post.json'
  );
  assert.deepEqual(errors, []);
  assert.ok(warnings.some((w) => w.includes('has no data')));
});

// ---------- articleWordCount / isStructuredBody ----------
test('articleWordCount: counts words in a plain string body', () => {
  assert.equal(articleWordCount('one two three four'), 4);
});

test('articleWordCount: counts words across introduction + all section content', () => {
  const count = articleWordCount({
    introduction: 'one two',
    sections: [
      { id: 'a', title: 'A', content: 'three four five' },
      { id: 'b', title: 'B', content: 'six' },
    ],
  });
  assert.equal(count, 6);
});

test('isStructuredBody: narrows correctly for both shapes', () => {
  assert.equal(isStructuredBody('plain string'), false);
  assert.equal(isStructuredBody({ introduction: '', sections: [] }), true);
});

// ---------- parseRobotsDirective ----------
test('parseRobotsDirective: maps common directives to Next metadata shape', () => {
  assert.deepEqual(parseRobotsDirective('index, follow'), { index: true, follow: true });
  assert.deepEqual(parseRobotsDirective('noindex, nofollow'), { index: false, follow: false });
  assert.deepEqual(parseRobotsDirective('noindex, follow'), { index: false, follow: true });
  assert.equal(parseRobotsDirective(undefined), undefined);
});

// ---------- Every real content/blog/*.json file must actually validate ----------
// This is the regression guard: it fails the moment any future edit to a
// real article (or to validateBlogPost's rules) breaks a currently-good
// file, instead of that only surfacing as a silent weak page in prod.
test('every real blog article passes validateBlogPost with zero errors', () => {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json'));
  assert.ok(files.length > 0, 'expected at least one article in content/blog');

  for (const file of files) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const post = require(resolve(BLOG_DIR, file));
    const { errors } = validateBlogPost(post, file);
    assert.deepEqual(errors, [], `${file} should have no validation errors`);
  }
});

test('every real blog article with seoMetadata.canonicalUrl points at the non-www host', () => {
  const files = readdirSync(BLOG_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const post = require(resolve(BLOG_DIR, file));
    const canonical = post.seoMetadata?.canonicalUrl;
    if (canonical) {
      assert.ok(
        !new URL(canonical).host.startsWith('www.'),
        `${file}: canonical URL should use the non-www host, got ${canonical}`
      );
    }
  }
});

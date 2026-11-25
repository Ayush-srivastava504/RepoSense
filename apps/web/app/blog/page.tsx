// Module: app/blog/page.tsx
// Defines component(s)/export(s): BlogIndexPage

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { headers, cookies } from 'next/headers';
import { BASE_URL } from '@/lib/jobs';
import { getAllPosts, articleWordCount, type BlogPost } from '@/lib/blog';
import { readingMinutes } from '@/lib/blogMarkdown';
import { breadcrumbSchema, itemListSchema, languageAlternates } from '@/lib/structuredData';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';
import Breadcrumbs from '@/app/components/Breadcrumbs';

const META_DESCRIPTION =
  'Practical career guides for engineering students and junior developers: ATS resumes, GitHub portfolios, interviews, AI and data roles, and remote jobs.';

export const metadata: Metadata = {
  title: { absolute: 'Tech Career Guides for Students & Freshers | InternFlow' },
  description: META_DESCRIPTION,
  alternates: {
    canonical: `${BASE_URL}/blog`,
    languages: languageAlternates('/blog'),
  },
  openGraph: {
    title: 'Tech Career Guides for Students & Freshers',
    description: META_DESCRIPTION,
    url: `${BASE_URL}/blog`,
    type: 'website',
    siteName: 'InternFlow',
  },
};

export const revalidate = 3600;

const label = (category: string) => category.replace(/-/g, ' ');

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function PostCard({ post, href, locale }: { post: BlogPost; href: string; locale: Locale }) {
  return (
    <Link href={href} className="blog-card">
      <span className="blog-category">{label(post.category)}</span>
      <h3 className="mt-3 text-lg font-semibold leading-snug">{post.title}</h3>
      <p className="mt-2 text-sm leading-relaxed line-clamp-3" style={{ color: 'var(--ink-soft)' }}>
        {post.description}
      </p>
      <span className="mt-auto flex w-full items-center justify-between pt-5 text-xs" style={{ color: 'var(--muted)' }}>
        <time dateTime={post.updatedAt || post.publishedAt}>{formatDate(post.updatedAt || post.publishedAt, locale)}</time>
        <span>{readingMinutes(articleWordCount(post.body))} min read</span>
      </span>
    </Link>
  );
}

export default async function BlogIndexPage() {
  const headerList = headers();
  const cookieStore = cookies();
  const locale = (headerList.get('x-locale') || cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;

  const dict = await getDictionary(locale);
  const posts = getAllPosts(locale);
  const href = (slug: string) => (locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`);

  const [featured, ...rest] = posts;
  // Group the remaining posts by category, biggest group first, so the page
  // reads as topic hubs rather than one undifferentiated date-sorted list.
  const groups = new Map<string, BlogPost[]>();
  for (const p of rest) groups.set(p.category, [...(groups.get(p.category) || []), p]);
  const categories = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  const counts = new Map<string, number>();
  for (const p of posts) counts.set(p.category, (counts.get(p.category) || 0) + 1);

  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
  ]);
  const list = itemListSchema(
    'InternFlow career guides',
    posts.map((p) => ({ name: p.title, url: `${BASE_URL}/blog/${p.slug}` }))
  );

  return (
    <main className="w-full">
      <Script id="blog-index-breadcrumb" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <Script id="blog-index-itemlist" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(list) }} />

      <header className="blog-hero">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-14">
          <Breadcrumbs schema={crumbs} />
          <p className="eyebrow eyebrow-accent mt-8">{dict.blog?.eyebrow || '// guides'}</p>
          <h1 className="display mt-3 max-w-3xl text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
            Tech career guides for students &amp; freshers
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            Long-form, practical guides on getting hired in tech: resumes that pass ATS filters, GitHub portfolios
            recruiters actually open, interview preparation, and the skills AI, data and DevOps roles ask for.
          </p>
          {categories.length > 1 && (
            <nav aria-label="Blog topics" className="mt-8 flex flex-wrap gap-2">
              {Array.from(counts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([cat, n]) => (
                  <a key={cat} href={`#${cat}`} className="blog-filter capitalize">
                    {label(cat)} <span className="blog-filter-count">{n}</span>
                  </a>
                ))}
            </nav>
          )}
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        {posts.length === 0 ? (
          <p style={{ color: 'var(--ink-soft)' }}>{dict.blog?.empty || 'First guides are on the way — check back soon.'}</p>
        ) : (
          <>
            {featured && (
              <section aria-labelledby="latest-guide" id={groups.has(featured.category) ? undefined : featured.category} className="scroll-mt-24">
                <h2 id="latest-guide" className="blog-toc-title">Latest guide</h2>
                <Link href={href(featured.slug)} className="blog-card blog-card-featured mt-4">
                  <span className="blog-category">{label(featured.category)}</span>
                  <span className="display mt-4 block max-w-3xl text-2xl font-semibold leading-tight sm:text-3xl">{featured.title}</span>
                  <span className="mt-3 block max-w-2xl leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{featured.description}</span>
                  <span className="mt-6 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--muted)' }}>
                    <span>{featured.author?.name || 'InternFlow Editorial'}</span>
                    <span aria-hidden="true">·</span>
                    <span>{readingMinutes(articleWordCount(featured.body))} min read</span>
                    <span className="font-medium" style={{ color: 'var(--green)' }}>Read guide →</span>
                  </span>
                </Link>
              </section>
            )}

            {categories.map(([cat, items]) => (
              <section key={cat} id={cat} aria-labelledby={`${cat}-title`} className="mt-14 scroll-mt-24">
                <div className="flex items-baseline justify-between gap-4 border-b pb-3" style={{ borderColor: 'var(--line)' }}>
                  <h2 id={`${cat}-title`} className="display text-2xl font-semibold capitalize tracking-tight">{label(cat)}</h2>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {counts.get(cat)} {counts.get(cat) === 1 ? 'guide' : 'guides'}
                  </span>
                </div>
                <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {items.map((post) => (
                    <PostCard key={post.slug} post={post} href={href(post.slug)} locale={locale} />
                  ))}
                </div>
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

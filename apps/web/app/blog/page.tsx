// Module: app/blog/page.tsx
// Defines component(s)/export(s): BlogIndexPage

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { headers, cookies } from 'next/headers';
import { BASE_URL } from '@/lib/jobs';
import { getAllPosts } from '@/lib/blog';
import { breadcrumbSchema } from '@/lib/structuredData';
import { getDictionary } from '@/i18n/get-dictionary';
import type { Locale } from '@/i18n/config';

export const metadata: Metadata = {
  title: 'Engineering & Tech Career Guides — InternFlow Blog',
  description: 'In-depth, actionable guides on AI engineering, modern data stacks, DevOps, system design, ATS resume algorithms, and global remote developer hiring.',
  alternates: {
    canonical: `${BASE_URL}/blog`,
    languages: {
      'x-default': `${BASE_URL}/blog`,
      'en': `${BASE_URL}/blog`,
      'es': `${BASE_URL}/es/blog`,
      'ja': `${BASE_URL}/ja/blog`,
      'fr': `${BASE_URL}/fr/blog`,
      'de': `${BASE_URL}/de/blog`,
      'pt': `${BASE_URL}/pt/blog`,
      'ko': `${BASE_URL}/ko/blog`,
      'it': `${BASE_URL}/it/blog`,
      'hi': `${BASE_URL}/hi/blog`,
    },
  },
};

export const revalidate = 3600;

export default async function BlogIndexPage() {
  const headerList = headers();
  const cookieStore = cookies();
  const locale = (headerList.get('x-locale') || cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;

  const dict = await getDictionary(locale);
  const posts = getAllPosts(locale);

  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
  ]);

  return (
    <main className="w-full">
      <Script
        id="blog-index-breadcrumb"
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />

      <div className="mx-auto w-full max-w-5xl px-3 py-10 sm:px-4 sm:py-14">
        <p className="eyebrow eyebrow-accent">{dict.blog?.eyebrow || '// guides'}</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          {dict.blog?.title || 'Tech Career & Engineering Guides'}
        </h1>
        <p className="mt-3 max-w-2xl text-base leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {dict.blog?.subtitle ||
            'Trending deep dives on AI Engineering, modern data pipelines, DevOps & cloud architecture, ATS resume parsing, and high-paying remote tech opportunities.'}
        </p>

        {posts.length === 0 ? (
          <p className="mt-10" style={{ color: 'var(--ink-soft)' }}>
            {dict.blog?.empty || 'First guides are on the way — check back soon.'}
          </p>
        ) : (
          <div className="mt-10 grid gap-5 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={locale === 'en' ? `/blog/${post.slug}` : `/${locale}/blog/${post.slug}`}
                className="panel card-lift rounded-xl p-6 transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs mb-2">
                    <span className="chip chip-green uppercase tracking-wide">
                      {post.category.replace(/-/g, ' ')}
                    </span>
                    {post.readingTime && (
                      <span style={{ color: 'var(--muted)' }}>{post.readingTime}</span>
                    )}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold leading-snug">{post.title}</h2>
                  <p className="mt-2.5 text-sm line-clamp-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                    {post.description}
                  </p>
                </div>

                <div className="mt-5 flex items-center justify-between border-t pt-3 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
                  <span>{post.author?.name || 'InternFlow'}</span>
                  <span>
                    {new Date(post.publishedAt).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

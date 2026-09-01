// Module: app/blog/[slug]/page.tsx
// Defines component(s)/export(s): BlogPostPage
// Defines function(s): generateStaticParams, generateMetadata, renderBody
// Defines type(s): Props

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { BASE_URL } from '@/lib/jobs';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { breadcrumbSchema, ORG_NAME, ORG_LOGO } from '@/lib/structuredData';
import { i18n, type Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';

interface Props {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  const languageAlternates: Record<string, string> = {
    'x-default': `${BASE_URL}/blog/${post.slug}`,
    'en': `${BASE_URL}/blog/${post.slug}`,
  };

  i18n.locales.forEach((loc) => {
    if (loc !== 'en') {
      languageAlternates[loc] = `${BASE_URL}/${loc}/blog/${post.slug}`;
    }
  });

  const imageUrl = post.image?.url || `${BASE_URL}/og-image.png`;
  const imageAlt = post.image?.alt || post.title;

  return {
    title: `${post.title} | InternFlow Blog`,
    description: post.description,
    keywords: post.tags || [post.keyword],
    alternates: {
      canonical: `${BASE_URL}/blog/${post.slug}`,
      languages: languageAlternates,
    },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      url: `${BASE_URL}/blog/${post.slug}`,
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: imageAlt,
        },
      ],
      siteName: 'InternFlow',
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [imageUrl],
    },
  };
}

function renderBody(body: string) {
  const blocks = body.split('\n\n');
  return blocks.map((block, i) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-8 text-xl font-semibold tracking-tight">
          {block.replace('## ', '')}
        </h2>
      );
    }
    if (block.startsWith('### ')) {
      return (
        <h3 key={i} className="mt-6 text-lg font-medium">
          {block.replace('### ', '')}
        </h3>
      );
    }
    if (block.startsWith('- ')) {
      const items = block.split('\n').map((l) => l.replace(/^- /, ''));
      return (
        <ul key={i} className="mt-3 list-disc space-y-1.5 pl-5 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
          {items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mt-4 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {block}
      </p>
    );
  });
}

export default async function BlogPostPage({ params }: Props) {
  const headerList = headers();
  const cookieStore = cookies();
  const locale = (headerList.get('x-locale') || cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;

  const dict = await getDictionary(locale);
  const post = getPostBySlug(params.slug, locale);
  if (!post) notFound();

  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
    { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
  ]);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    image: post.image?.url || `${BASE_URL}/og-image.png`,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Organization',
      name: post.author?.name || ORG_NAME,
      url: BASE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: `${BASE_URL}/blog/${post.slug}`,
  };

  const faqSchema = post.faq
    ? {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: post.faq.map((f) => ({
          '@type': 'Question',
          name: f.q,
          acceptedAnswer: { '@type': 'Answer', text: f.a },
        })),
      }
    : null;

  return (
    <main className="w-full">
      <Script
        id={`blog-post-breadcrumb-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <Script
        id={`blog-post-article-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faqSchema && (
        <Script
          id={`blog-post-faq-${post.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
      )}

      <article className="mx-auto w-full max-w-3xl px-3 py-10 sm:px-4 sm:py-14">
        <Link
          href={locale === 'en' ? '/blog' : `/${locale}/blog`}
          className="text-sm font-medium transition hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {dict.blog?.backToAll || '← All guides'}
        </Link>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="chip chip-green text-xs uppercase tracking-wide">
            {post.category.replace(/-/g, ' ')}
          </span>
          {post.readingTime && (
            <span className="text-xs" style={{ color: 'var(--muted)' }}>
              • {post.readingTime}
            </span>
          )}
        </div>

        <h1 className="display mt-3 text-3xl font-medium sm:text-4xl leading-tight">
          {post.title}
        </h1>

        <div
          className="mt-4 flex items-center justify-between border-b pb-4 text-xs"
          style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}
        >
          <div>
            <span>By {post.author?.name || 'InternFlow Engineering'}</span>
            <span className="mx-2">•</span>
            <span>
              {dict.blog?.published || 'Published'}{' '}
              {new Date(post.publishedAt).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </div>
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="rounded px-2 py-0.5 text-xs font-mono"
                style={{ background: 'var(--hover)', color: 'var(--ink-soft)' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-8 prose-tech">{renderBody(post.body)}</div>

        {post.faq && post.faq.length > 0 && (
          <div
            className="mt-12 rounded-xl border p-6"
            style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}
          >
            <h2 className="text-xl font-semibold mb-4">
              {dict.blog?.faqTitle || 'Frequently Asked Questions'}
            </h2>
            <div className="space-y-4">
              {post.faq.map((f, i) => (
                <div
                  key={i}
                  className="border-t pt-4 first:border-t-0 first:pt-0"
                  style={{ borderColor: 'var(--line)' }}
                >
                  <p className="font-medium text-base">{f.q}</p>
                  <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Career Tools Call to Action */}
        <div
          className="mt-12 rounded-xl p-6 text-center border"
          style={{ background: 'var(--hover)', borderColor: 'var(--line)' }}
        >
          <h3 className="text-lg font-medium">Accelerate Your Tech Job Search</h3>
          <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-soft)' }}>
            Score your resume against any job description and generate tailored cover letters for free.
          </p>
          <div className="mt-4 flex justify-center gap-3">
            <Link href="/tools/ats-resume-checker" className="btn btn-primary text-sm">
              Try ATS Resume Checker
            </Link>
            <Link href="/jobs" className="btn btn-secondary text-sm">
              Browse Open Jobs
            </Link>
          </div>
        </div>
      </article>
    </main>
  );
}

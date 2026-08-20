import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';

import { BASE_URL } from '@/lib/jobs';
import { getAllPosts, getPostBySlug } from '@/lib/blog';
import { breadcrumbSchema, ORG_NAME, ORG_LOGO } from '@/lib/structuredData';

interface Props {
  params: { slug: string };
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  return {
    title: post.title,
    description: post.description,
    keywords: [post.keyword],
    alternates: { canonical: `${BASE_URL}/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.publishedAt,
      url: `${BASE_URL}/blog/${post.slug}`,
      images: [
        {
          url: `${BASE_URL}/og-image.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
      images: [`${BASE_URL}/og-image.png`],
    },
  };
}

function renderBody(body: string) {
  // Simple markdown-ish renderer: paragraphs + "## " headings + "- " bullets.
  const blocks = body.split('\n\n');
  return blocks.map((block, i) => {
    if (block.startsWith('## ')) {
      return (
        <h2 key={i} className="mt-8 text-xl font-medium">
          {block.replace('## ', '')}
        </h2>
      );
    }
    if (block.startsWith('- ')) {
      const items = block.split('\n').map((l) => l.replace(/^- /, ''));
      return (
        <ul key={i} className="mt-3 list-disc space-y-1 pl-5">
          {items.map((item, j) => (
            <li key={j}>{item}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={i} className="mt-4" style={{ color: 'var(--ink-soft)' }}>
        {block}
      </p>
    );
  });
}

export default function BlogPostPage({ params }: Props) {
  const post = getPostBySlug(params.slug);
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
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: { '@type': 'Organization', name: ORG_NAME },
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
        <Link href="/blog" className="text-sm" style={{ color: 'var(--accent)' }}>
          ← All guides
        </Link>
        <p className="eyebrow eyebrow-accent mt-4">{post.category.replace(/-/g, ' ')}</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">{post.title}</h1>
        <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>
          Published{' '}
          {new Date(post.publishedAt).toLocaleDateString('en-IN', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          })}
        </p>

        <div className="mt-6">{renderBody(post.body)}</div>

        {post.faq && (
          <div className="mt-10">
            <h2 className="text-xl font-medium">FAQs</h2>
            {post.faq.map((f, i) => (
              <div key={i} className="mt-4">
                <p className="font-medium">{f.q}</p>
                <p className="mt-1" style={{ color: 'var(--ink-soft)' }}>
                  {f.a}
                </p>
              </div>
            ))}
          </div>
        )}
      </article>
    </main>
  );
}

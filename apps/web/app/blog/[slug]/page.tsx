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
import { getAllPosts, getPostBySlug, isStructuredBody, articleWordCount, type BodySection } from '@/lib/blog';
import { breadcrumbSchema, faqSchema, languageAlternates, ORG_NAME, ORG_LOGO } from '@/lib/structuredData';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import Breadcrumbs from '@/app/components/Breadcrumbs';

interface Props {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

/** "index, follow" / "noindex, nofollow" -> Next.js Metadata robots object. */
function parseRobotsDirective(robots?: string): Metadata['robots'] | undefined {
  if (!robots) return undefined;
  const tokens = robots.toLowerCase().split(',').map((t) => t.trim());
  return {
    index: !tokens.includes('noindex'),
    follow: !tokens.includes('nofollow'),
  };
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  const seo = post.seoMetadata;
  const metaTitle = seo?.metaTitle || `${post.title} | InternFlow Blog`;
  const metaDescription = seo?.metaDescription || post.description;
  const canonicalUrl = seo?.canonicalUrl || `${BASE_URL}/blog/${post.slug}`;
  const imageUrl = post.image?.url || `${BASE_URL}/og-image.png`;
  const imageAlt = post.image?.alt || post.title;

  return {
    title: metaTitle,
    description: metaDescription,
    keywords: post.tags || [post.keyword],
    alternates: {
      canonical: canonicalUrl,
      languages: languageAlternates(`/blog/${post.slug}`),
    },
    robots: parseRobotsDirective(seo?.robots),
    openGraph: {
      title: seo?.metaTitle || post.title,
      description: metaDescription,
      type: 'article',
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt || post.publishedAt,
      url: canonicalUrl,
      images: [
        {
          url: imageUrl,
          width: post.image?.width || 1200,
          height: post.image?.height || 630,
          alt: imageAlt,
        },
      ],
      siteName: 'InternFlow',
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDescription,
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

/**
 * Renders whichever "extra" shape a section carries, if any. Sections in the
 * structured format share id/title/content but differ after that (a skill
 * graph, a comparison table, a list of career paths, ...). Unknown/future
 * shapes are simply skipped here rather than guessed at.
 */
function renderSectionExtra(section: BodySection) {
  if (section.graph) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {section.graph.nodes.map((node) => (
          <div key={node.name} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-medium">{node.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {node.skills.map((skill) => (
                <span key={skill} className="rounded px-2 py-0.5 text-xs font-mono" style={{ background: 'var(--hover)', color: 'var(--ink-soft)' }}>
                  {skill}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (section.examples) {
    return (
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {section.examples.map((ex) => (
          <div key={ex.cluster} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-medium">{ex.cluster}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{ex.skills.join(', ')}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.comparison) {
    return (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left" style={{ borderColor: 'var(--line)' }}>
              <th className="py-2 pr-4 font-medium">Level</th>
              <th className="py-2 font-medium">Typical focus</th>
            </tr>
          </thead>
          <tbody>
            {section.comparison.map((row) => (
              <tr key={row.level} className="border-b" style={{ borderColor: 'var(--line)' }}>
                <td className="py-2 pr-4 font-medium">{row.level}</td>
                <td className="py-2" style={{ color: 'var(--ink-soft)' }}>{row.typicalFocus.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (section.paths) {
    return (
      <div className="mt-4 space-y-3">
        {section.paths.map((p) => (
          <div key={p.startingRole} className="rounded-lg border p-3" style={{ borderColor: 'var(--line)' }}>
            <p className="text-sm font-medium">From: {p.startingRole}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>Bridge skills: {p.bridgeSkills.join(', ')}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.salaryDimensions || section.signals) {
    const items = section.salaryDimensions || section.signals || [];
    return (
      <ul className="mt-4 list-disc space-y-1.5 pl-5 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return null;
}

function renderStructuredBody(body: { introduction: string; sections: BodySection[] }) {
  return (
    <>
      <p className="leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{body.introduction}</p>
      {body.sections.map((section) => (
        <section key={section.id} id={section.id} className="mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          <p className="mt-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{section.content}</p>
          {renderSectionExtra(section)}
        </section>
      ))}
    </>
  );
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
    description: post.seoMetadata?.metaDescription || post.description,
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
    keywords: (post.tags && post.tags.length > 0 ? post.tags : [post.keyword]).join(', '),
    articleSection: post.category.replace(/-/g, ' '),
    wordCount: articleWordCount(post.body),
    inLanguage: locale,
  };

  const faq = post.faq
    ? faqSchema(post.faq.map((f) => ({ question: f.q, answer: f.a })))
    : null;

  return (
    <main className="w-full">
      <Script
        id={`blog-post-breadcrumb-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }}
      />
      <Breadcrumbs schema={crumbs}/>
      <Script
        id={`blog-post-article-${post.slug}`}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      {faq && (
        <Script
          id={`blog-post-faq-${post.slug}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }}
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

        {post.hero?.eyebrow && (
          <p className="mt-3 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
            {post.hero.eyebrow}
          </p>
        )}

        <h1 className="display mt-3 text-3xl font-medium sm:text-4xl leading-tight">
          {post.title}
        </h1>

        {post.hero?.summary && (
          <p className="mt-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
            {post.hero.summary}
          </p>
        )}

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

        {post.keyTakeaways && post.keyTakeaways.length > 0 && (
          <div className="mt-8 rounded-xl border p-5" style={{ borderColor: 'var(--line)', background: 'var(--surface)' }}>
            <h2 className="text-base font-semibold">Key takeaways</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {post.keyTakeaways.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-8 prose-tech">
          {isStructuredBody(post.body) ? renderStructuredBody(post.body) : renderBody(post.body)}
        </div>

        {post.charts && post.charts.length > 0 && (
          <div className="mt-8 space-y-6">
            {post.charts
              .filter((chart) => chart.series.some((s) => s.data.length > 0))
              .map((chart) => (
                <div key={chart.title} className="rounded-xl border p-5" style={{ borderColor: 'var(--line)' }}>
                  <h3 className="text-base font-medium">{chart.title}</h3>
                  {chart.description && (
                    <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{chart.description}</p>
                  )}
                  {/* Chart rendering wired up once the data pipeline populates chart.series[].data;
                      charts with empty series are filtered out above rather than shown blank. */}
                </div>
              ))}
          </div>
        )}

        {post.methodology && (
          <div className="mt-8 rounded-xl border p-5" style={{ borderColor: 'var(--line)' }}>
            <h2 className="text-base font-semibold">{post.methodology.title}</h2>
            <p className="mt-2 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{post.methodology.details}</p>
            {post.methodology.importantNote && (
              <p className="mt-2 text-sm leading-relaxed italic" style={{ color: 'var(--muted)' }}>{post.methodology.importantNote}</p>
            )}
          </div>
        )}

        {post.realWorldExample && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold tracking-tight">{post.realWorldExample.title}</h2>
            <p className="mt-3 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{post.realWorldExample.context}</p>
            <ol className="mt-3 list-decimal space-y-1.5 pl-5 leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {post.realWorldExample.workflow.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        )}

        {post.internalLinks && post.internalLinks.length > 0 && (
          <div className="mt-8">
            <h2 className="text-base font-semibold">Related</h2>
            <div className="mt-2 flex flex-wrap gap-3">
              {post.internalLinks.map((link) => (
                <Link key={link.url} href={link.url} className="text-sm font-medium hover:underline" style={{ color: 'var(--accent)' }}>
                  {link.anchorText}
                </Link>
              ))}
            </div>
          </div>
        )}

        {post.cta && (
          <div className="mt-8 rounded-xl p-6 text-center border" style={{ background: 'var(--hover)', borderColor: 'var(--line)' }}>
            <h3 className="text-lg font-medium">{post.cta.title}</h3>
            <p className="mt-2 text-sm max-w-md mx-auto" style={{ color: 'var(--ink-soft)' }}>{post.cta.description}</p>
            <div className="mt-4 flex justify-center">
              <Link href={post.cta.url} className="btn btn-primary text-sm">
                {post.cta.buttonText}
              </Link>
            </div>
          </div>
        )}

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

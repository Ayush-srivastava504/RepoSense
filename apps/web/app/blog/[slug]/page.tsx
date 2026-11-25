// Module: app/blog/[slug]/page.tsx
// Defines component(s)/export(s): BlogPostPage
// Defines function(s): generateStaticParams, generateMetadata
// Defines type(s): Props

import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';
import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
import { BASE_URL } from '@/lib/jobs';
import type { ComponentProps } from 'react';
import StatBarChart from '@/app/components/StatBarChart';
import { getChartStats, seriesFor } from '@/lib/chartStats';
import { getAllPosts, getPostBySlug, isStructuredBody, articleWordCount, type BlogPost, type BodySection } from '@/lib/blog';
import { parseMarkdown, headingsFromBlocks, readingMinutes, type Block, type Heading } from '@/lib/blogMarkdown';
import { getToolsForArticle } from '@/app/tools/data';
import { breadcrumbSchema, faqSchema, languageAlternates, ORG_NAME, ORG_LOGO } from '@/lib/structuredData';
import { parseRobotsDirective } from '@/lib/seo/robots';
import type { Locale } from '@/i18n/config';
import { getDictionary } from '@/i18n/get-dictionary';
import Breadcrumbs from '@/app/components/Breadcrumbs';
import ArticleBody, { Inline } from '../components/ArticleBody';

interface Props {
  params: {
    slug: string;
  };
}

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

/**
 * An authored image wins, except the site-wide /og-image.png placeholder that
 * older posts copied in: that made every article share one social card, so it
 * falls through to the per-article generator at /og/blog/<slug>.png.
 */
function articleImage(post: BlogPost): string {
  const authored = post.image?.url;
  if (authored && !authored.endsWith('/og-image.png')) return authored;
  return `${BASE_URL}/og/blog/${post.slug}.png`;
}

export function generateMetadata({ params }: Props): Metadata {
  const post = getPostBySlug(params.slug);
  if (!post) return {};

  const seo = post.seoMetadata;
  const metaTitle = seo?.metaTitle || `${post.title} | InternFlow Blog`;
  const metaDescription = seo?.metaDescription || post.description;
  const canonicalUrl = seo?.canonicalUrl || `${BASE_URL}/blog/${post.slug}`;
  const imageUrl = articleImage(post);
  const imageAlt = post.image?.alt || post.title;

  return {
    title: { absolute: metaTitle },
    description: metaDescription,
    keywords: post.tags || [post.keyword],
    authors: [{ name: post.author?.name || ORG_NAME }],
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
      section: post.category.replace(/-/g, ' '),
      tags: post.tags,
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

/**
 * Renders whichever "extra" shape a structured section carries, if any.
 * Unknown/future shapes are skipped rather than guessed at.
 */
function SectionExtra({ section }: { section: BodySection }) {
  if (section.graph) {
    return (
      <div className="not-prose mt-5 grid gap-3 sm:grid-cols-2">
        {section.graph.nodes.map((node) => (
          <div key={node.name} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper-dim)' }}>
            <p className="text-sm font-semibold">{node.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {node.skills.map((skill) => (
                <span key={skill} className="rounded-md px-2 py-0.5 font-mono text-xs" style={{ background: 'var(--paper)', color: 'var(--ink-soft)', border: '1px solid var(--line)' }}>
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
      <div className="not-prose mt-5 grid gap-3 sm:grid-cols-2">
        {section.examples.map((ex) => (
          <div key={ex.cluster} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper-dim)' }}>
            <p className="text-sm font-semibold">{ex.cluster}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>{ex.skills.join(' · ')}</p>
          </div>
        ))}
      </div>
    );
  }

  if (section.comparison) {
    return (
      <div className="blog-table-wrap">
        <table>
          <thead>
            <tr>
              <th scope="col">Level</th>
              <th scope="col">Typical focus</th>
            </tr>
          </thead>
          <tbody>
            {section.comparison.map((row) => (
              <tr key={row.level}>
                <td><strong>{row.level}</strong></td>
                <td>{row.typicalFocus.join(', ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (section.paths) {
    return (
      <div className="not-prose mt-5 space-y-3">
        {section.paths.map((p) => (
          <div key={p.startingRole} className="rounded-xl border p-4" style={{ borderColor: 'var(--line)', background: 'var(--paper-dim)' }}>
            <p className="text-sm font-semibold">From: {p.startingRole}</p>
            <p className="mt-1 text-sm" style={{ color: 'var(--ink-soft)' }}>Bridge skills: {p.bridgeSkills.join(', ')}</p>
          </div>
        ))}
      </div>
    );
  }

  const items = section.salaryDimensions || section.signals;
  if (items) {
    return (
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    );
  }

  return null;
}

function StructuredArticle({ body }: { body: { introduction: string; sections: BodySection[] } }) {
  return (
    <div className="blog-prose">
      {parseMarkdown(body.introduction).map((b, i) => (b.type === 'p' ? <p key={i}><Inline text={b.text} /></p> : null))}
      {body.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id}>{section.title}</h2>
          <ArticleBody blocks={parseMarkdown(section.content)} />
          <SectionExtra section={section} />
        </section>
      ))}
    </div>
  );
}

function TableOfContents({ headings, title }: { headings: Heading[]; title: string }) {
  const top = headings.filter((h) => h.level === 2);
  if (top.length < 2) return null;
  return (
    <nav aria-label="Table of contents" className="blog-toc">
      <p className="blog-toc-title">{title}</p>
      <ol>
        {top.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`}>{h.text}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function formatDate(value: string, locale: Locale) {
  return new Date(value).toLocaleDateString(locale === 'en' ? 'en-US' : locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/** Same-category posts first, then the most recent of the rest. */
function relatedPosts(post: BlogPost, locale: Locale, limit = 3): BlogPost[] {
  const others = getAllPosts(locale).filter((p) => p.slug !== post.slug);
  const same = others.filter((p) => p.category === post.category);
  const rest = others.filter((p) => p.category !== post.category);
  return [...same, ...rest].slice(0, limit);
}

export default async function BlogPostPage({ params }: Props) {
  const headerList = headers();
  const cookieStore = cookies();
  const locale = (headerList.get('x-locale') || cookieStore.get('NEXT_LOCALE')?.value || 'en') as Locale;

  const dict = await getDictionary(locale);
  const post = getPostBySlug(params.slug, locale);
  if (!post) notFound();

  const linkedTools = getToolsForArticle(post.slug);
  const blogHref = locale === 'en' ? '/blog' : `/${locale}/blog`;
  const postHref = (slug: string) => (locale === 'en' ? `/blog/${slug}` : `/${locale}/blog/${slug}`);

  // Charts render only from real nightly aggregates (chart_stats). A chart with no statsKey, no
  // stats row yet (too few listings), or a label the stats don't cover is omitted -- never faked.
  const liveCharts: ComponentProps<typeof StatBarChart>[] = [];
  for (const chart of post.charts ?? []) {
    if (!chart.statsKey || !chart.metric || !chart.xAxis?.length) continue;
    const stats = await getChartStats(chart.statsKey);
    const values = stats ? seriesFor(stats, chart.metric, chart.xAxis) : null;
    if (!stats || !values) continue;
    liveCharts.push({ title: chart.title, description: chart.description, labels: chart.xAxis, values,
      sampleSize: chart.metric === 'experience' ? stats.stats.experience_known : stats.sample_size, computedAt: stats.computed_at });
  }

  const structured = isStructuredBody(post.body);
  const blocks: Block[] = structured ? [] : parseMarkdown(post.body as string);
  const headings: Heading[] = structured
    ? (post.body as { sections: BodySection[] }).sections.map((s) => ({ id: s.id, text: s.title, level: 2 as const }))
    : headingsFromBlocks(blocks);
  const wordCount = articleWordCount(post.body);
  const minutes = readingMinutes(wordCount);
  const updated = post.updatedAt && post.updatedAt.slice(0, 10) !== post.publishedAt.slice(0, 10) ? post.updatedAt : null;
  const authorName = post.author?.name || 'InternFlow Editorial';
  const related = relatedPosts(post, locale);
  const tocTitle = 'On this page';

  const crumbs = breadcrumbSchema([
    { name: 'Home', url: BASE_URL },
    { name: 'Blog', url: `${BASE_URL}/blog` },
    { name: post.title, url: `${BASE_URL}/blog/${post.slug}` },
  ]);

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.seoMetadata?.metaDescription || post.description,
    image: articleImage(post),
    datePublished: post.publishedAt,
    dateModified: post.updatedAt || post.publishedAt,
    author: {
      '@type': 'Organization',
      name: authorName,
      url: `${BASE_URL}/about`,
    },
    publisher: {
      '@type': 'Organization',
      name: ORG_NAME,
      logo: { '@type': 'ImageObject', url: ORG_LOGO },
    },
    mainEntityOfPage: { '@type': 'WebPage', '@id': `${BASE_URL}/blog/${post.slug}` },
    keywords: (post.tags && post.tags.length > 0 ? post.tags : [post.keyword]).join(', '),
    articleSection: post.category.replace(/-/g, ' '),
    wordCount,
    timeRequired: `PT${minutes}M`,
    inLanguage: locale,
  };

  const faq = post.faq?.length ? faqSchema(post.faq.map((f) => ({ question: f.q, answer: f.a }))) : null;

  return (
    <main className="w-full">
      <Script id={`blog-post-breadcrumb-${post.slug}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(crumbs) }} />
      <Script id={`blog-post-article-${post.slug}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      {faq && (
        <Script id={`blog-post-faq-${post.slug}`} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      )}

      {/* Header */}
      <header className="blog-hero">
        <div className="mx-auto w-full max-w-6xl px-4 pb-10 pt-6 sm:px-6 sm:pb-12">
          <Breadcrumbs schema={crumbs} />
          <div className="mt-6 max-w-3xl">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Link href={`${blogHref}#${post.category}`} className="blog-category">
                {post.category.replace(/-/g, ' ')}
              </Link>
              <span style={{ color: 'var(--muted)' }}>{minutes} min read</span>
            </div>
            <h1 className="display mt-4 text-3xl font-semibold leading-[1.15] tracking-tight sm:text-[2.6rem]">{post.title}</h1>
            <p className="mt-4 text-lg leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
              {post.hero?.summary || post.description}
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              <span className="blog-avatar" aria-hidden="true">{authorName.charAt(0)}</span>
              <span>
                <span className="font-medium" style={{ color: 'var(--ink)' }}>{authorName}</span>
                {post.author?.role && <span style={{ color: 'var(--muted)' }}> · {post.author.role}</span>}
              </span>
              <span aria-hidden="true" style={{ color: 'var(--line-strong)' }}>|</span>
              {updated ? (
                <span>
                  Updated <time dateTime={updated}>{formatDate(updated, locale)}</time>
                </span>
              ) : (
                <span>
                  {dict.blog?.published || 'Published'} <time dateTime={post.publishedAt}>{formatDate(post.publishedAt, locale)}</time>
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14">
        <article className="min-w-0 max-w-3xl">
          {post.keyTakeaways && post.keyTakeaways.length > 0 && (
            <aside className="blog-callout mb-10" aria-label="Key takeaways">
              <p className="blog-callout-title">Key takeaways</p>
              <ul>
                {post.keyTakeaways.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            </aside>
          )}

          {/* Mobile TOC: collapsed so the article starts above the fold */}
          {headings.filter((h) => h.level === 2).length >= 2 && (
            <details className="blog-toc-mobile mb-8 lg:hidden">
              <summary>{tocTitle}</summary>
              <TableOfContents headings={headings} title="" />
            </details>
          )}

          {structured ? <StructuredArticle body={post.body as { introduction: string; sections: BodySection[] }} /> : <ArticleBody blocks={blocks} />}

          {liveCharts.length > 0 && (
            <div className="mt-10 space-y-6">
              {liveCharts.map((c) => (
                <StatBarChart key={c.title} {...c} />
              ))}
            </div>
          )}

          {post.realWorldExample && (
            <section className="blog-prose mt-10" aria-labelledby="real-world-example">
              <h2 id="real-world-example">{post.realWorldExample.title}</h2>
              <p>{post.realWorldExample.context}</p>
              <ol>
                {post.realWorldExample.workflow.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </section>
          )}

          {post.methodology && (
            <aside className="blog-callout mt-10" aria-label={post.methodology.title}>
              <p className="blog-callout-title">{post.methodology.title}</p>
              <p className="text-sm leading-relaxed">{post.methodology.details}</p>
              {post.methodology.importantNote && (
                <p className="mt-2 text-sm italic leading-relaxed" style={{ color: 'var(--muted)' }}>{post.methodology.importantNote}</p>
              )}
            </aside>
          )}

          {post.faq && post.faq.length > 0 && (
            <section className="mt-14" aria-labelledby="faq">
              <h2 id="faq" className="display text-2xl font-semibold tracking-tight">
                {dict.blog?.faqTitle || 'Frequently asked questions'}
              </h2>
              <div className="mt-5 divide-y rounded-2xl border" style={{ borderColor: 'var(--line)' }}>
                {post.faq.map((f, i) => (
                  <details key={i} className="blog-faq group" open={i === 0}>
                    <summary>
                      <span>{f.q}</span>
                      <span aria-hidden="true" className="blog-faq-icon">+</span>
                    </summary>
                    <p>{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          {post.tags && post.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span key={tag} className="rounded-full border px-3 py-1 text-xs" style={{ borderColor: 'var(--line)', color: 'var(--ink-soft)' }}>
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* CTA */}
          <div className="blog-cta mt-12">
            <div>
              <p className="text-lg font-semibold">
                {post.cta?.title || (linkedTools[0] ? `Try ${linkedTools[0].shortName}` : 'Check your resume before you apply')}
              </p>
              <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>
                {post.cta?.description || linkedTools[0]?.tagline || 'Score your resume against any job description and see exactly which keywords are missing. Free.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href={post.cta?.url || linkedTools[0]?.ctaHref || '/ats-checker'} className="btn btn-primary text-sm">
                {post.cta?.buttonText || linkedTools[0]?.ctaLabel || 'Run free ATS check'}
              </Link>
              <Link href="/jobs" className="btn btn-secondary text-sm">
                Browse open roles
              </Link>
            </div>
          </div>
        </article>

        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-8">
            <TableOfContents headings={headings} title={tocTitle} />
            {(linkedTools.length > 0 || (post.internalLinks?.length ?? 0) > 0) && (
              <div>
                <p className="blog-toc-title">Useful tools</p>
                <ul className="mt-3 space-y-2 text-sm">
                  {linkedTools.map((tool) => (
                    <li key={tool.slug}>
                      <Link href={`/tools/${tool.slug}`} className="blog-side-link">{tool.shortName} →</Link>
                    </li>
                  ))}
                  {post.internalLinks?.map((link) => (
                    <li key={link.url}>
                      <Link href={link.url.replace(BASE_URL, '') || '/'} className="blog-side-link">{link.anchorText} →</Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="border-t" style={{ borderColor: 'var(--line)', background: 'var(--paper-dim)' }} aria-labelledby="related-guides">
          <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
            <div className="flex items-end justify-between gap-4">
              <h2 id="related-guides" className="display text-2xl font-semibold tracking-tight">Keep reading</h2>
              <Link href={blogHref} className="text-sm font-medium hover:underline" style={{ color: 'var(--green)' }}>
                {(dict.blog?.backToAll || 'All guides').replace(/^←\s*/, '')} →
              </Link>
            </div>
            <div className="mt-6 grid gap-5 md:grid-cols-3">
              {related.map((p) => (
                <Link key={p.slug} href={postHref(p.slug)} className="blog-card">
                  <span className="blog-category">{p.category.replace(/-/g, ' ')}</span>
                  <span className="mt-3 block text-base font-semibold leading-snug">{p.title}</span>
                  <span className="mt-2 block text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--ink-soft)' }}>{p.description}</span>
                  <span className="mt-4 block text-xs" style={{ color: 'var(--muted)' }}>{readingMinutes(articleWordCount(p.body))} min read</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

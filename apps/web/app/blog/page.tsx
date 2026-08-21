import type { Metadata } from 'next';
import Link from 'next/link';
import Script from 'next/script';

import { BASE_URL } from '@/lib/jobs';
import { getAllPosts } from '@/lib/blog';
import { breadcrumbSchema } from '@/lib/structuredData';

export const metadata: Metadata = {
  title: 'Career & Internship Guides — Blog',
  description:
    'Practical, no-fluff guides on internships, ATS resumes, GitHub portfolios, LinkedIn, hackathons, and job hunting for engineering students in India and abroad.',
  alternates: { canonical: `${BASE_URL}/blog` },
};

export const revalidate = 3600;

export default function BlogIndexPage() {
  const posts = getAllPosts();
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
        <p className="eyebrow eyebrow-accent">// guides</p>
        <h1 className="display mt-2 text-3xl font-medium sm:text-4xl">
          Career & internship guides
        </h1>
        <p className="mt-3 max-w-2xl" style={{ color: 'var(--ink-soft)' }}>
          New guide published daily — internships, ATS resumes, GitHub portfolios, LinkedIn, and
          hackathons, written for engineering students.
        </p>

        {posts.length === 0 ? (
          <p className="mt-10" style={{ color: 'var(--ink-soft)' }}>
            First guides are on the way — check back soon.
          </p>
        ) : (
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="rounded-xl border p-5 transition hover:border-[var(--accent)]"
                style={{ borderColor: 'var(--border)' }}
              >
                <p className="text-xs uppercase tracking-wide" style={{ color: 'var(--ink-soft)' }}>
                  {post.category.replace(/-/g, ' ')}
                </p>
                <h2 className="mt-1 text-lg font-medium">{post.title}</h2>
                <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
                  {post.description}
                </p>
                <p className="mt-3 text-xs" style={{ color: 'var(--ink-soft)' }}>
                  {new Date(post.publishedAt).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

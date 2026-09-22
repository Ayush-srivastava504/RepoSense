// Module: app/og/blog/[filename]/route.tsx
// Defines component(s)/export(s): GET
//
// SEO plan Phase 6 item 22 — "generate consistent OG images" for blog
// posts. Mirrors app/og/[filename]/route.tsx's per-job pattern: a real,
// distinct 1200x630 card per article (title, category, InternFlow
// branding) instead of every post either sharing the single generic
// /og-image.png or pointing at a static per-article file that may not
// exist (see the ML-engineer article's content JSON, which referenced
// og-ml-engineer-market-2026.png — a file nothing in the repo produces).
//
// Unlike the per-job route, this one is NOT `runtime = 'edge'`: it reads
// the article straight off disk via getPostBySlug (lib/blog's fs-based
// reader), and fs isn't available in the edge runtime. Blog posts are a
// few dozen static files rather than thousands of hourly-changing jobs,
// so the plain Node runtime with a long CDN cache is the right tradeoff
// here — no need for the edge/ISR complexity the job route takes on.

import { ImageResponse } from 'next/og';
import { getPostBySlug } from '@/lib/blog';

const WIDTH = 1200;
const HEIGHT = 630;

// Same palette as the per-job OG route / app/globals.css light-mode tokens.
const PAPER = '#faf9f6';
const INK = '#15171c';
const INK_SOFT = '#4a4d55';
const ACCENT = '#2f6f4f';
const LINE = '#e2ddcd';

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function fallbackImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: PAPER,
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 56, fontWeight: 700, color: INK }}>InternFlow Blog</div>
        <div style={{ marginTop: 16, fontSize: 26, color: INK_SOFT }}>
          Guides for engineering students and job seekers
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Shorter TTL than the per-article image below — this is the
        // fallback for a bad/unknown slug, worth re-checking sooner.
        'Cache-Control': 'public, max-age=3600, s-maxage=86400',
      },
    }
  );
}

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  const slug = params.filename.replace(/\.png$/i, '');
  if (!slug) {
    return fallbackImage();
  }

  // getPostBySlug is a synchronous fs read (see lib/blog.ts) and throws if
  // the article fails validation — degrade to the generic card rather than
  // 500ing an OG image request over a content bug.
  let post;
  try {
    post = getPostBySlug(slug);
  } catch {
    post = null;
  }
  if (!post) {
    return fallbackImage();
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: PAPER,
          padding: '64px 72px',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: ACCENT,
              marginRight: 12,
              display: 'flex',
            }}
          />
          <div style={{ fontSize: 28, fontWeight: 700, color: INK, display: 'flex' }}>InternFlow Blog</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 22,
              fontWeight: 600,
              color: ACCENT,
              textTransform: 'uppercase',
              letterSpacing: 1,
              display: 'flex',
            }}
          >
            {post.category.replace(/-/g, ' ')}
          </div>
          <div
            style={{
              marginTop: 16,
              fontSize: 52,
              fontWeight: 700,
              lineHeight: 1.15,
              color: INK,
              display: 'flex',
            }}
          >
            {truncate(post.title, 90)}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 32,
            borderTop: `2px solid ${LINE}`,
          }}
        >
          <div style={{ fontSize: 22, color: INK_SOFT, display: 'flex' }}>intern-flow.in/blog</div>
          {post.readingTime && (
            <div style={{ fontSize: 20, color: INK_SOFT, display: 'flex' }}>{post.readingTime}</div>
          )}
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        // Article content essentially never changes post-publish (aside
        // from occasional updatedAt edits), so this can cache long —
        // matching the per-job route's reasoning.
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
      },
    }
  );
}

// Module: app/og/tools/[filename]/route.tsx
// Defines component(s)/export(s): GET
//
// Per-tool OG image (Tools SEO pass, item 1) — mirrors app/og/[filename]/route.tsx
// (jobs) and app/og/blog/[filename]/route.tsx (blog): a real, distinct
// 1200x630 card per tool (name, tagline, category) instead of every tool
// page sharing the single generic /og-image.png.
//
// TOOLS is a static in-memory array (app/tools/data.ts) with no fs access,
// so — unlike the blog route — this can safely run on the edge runtime
// like the job route does.

import { ImageResponse } from 'next/og';
import { getToolBySlug } from '@/app/tools/data';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

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
        <div style={{ fontSize: 56, fontWeight: 700, color: INK }}>InternFlow Tools</div>
        <div style={{ marginTop: 16, fontSize: 26, color: INK_SOFT }}>
          Free AI tools for internship and job applications
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: { 'Cache-Control': 'public, max-age=3600, s-maxage=86400' },
    }
  );
}

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
  const slug = params.filename.replace(/\.png$/i, '');
  const tool = slug ? getToolBySlug(slug) : undefined;
  if (!tool) {
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
          <div style={{ fontSize: 28, fontWeight: 700, color: INK, display: 'flex' }}>InternFlow</div>
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
            {tool.category}
          </div>
          <div style={{ marginTop: 16, fontSize: 52, fontWeight: 700, lineHeight: 1.15, color: INK, display: 'flex' }}>
            {truncate(tool.name, 70)}
          </div>
          <div style={{ marginTop: 20, fontSize: 28, color: INK_SOFT, display: 'flex' }}>
            {truncate(tool.tagline, 90)}
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
          <div style={{ fontSize: 22, color: INK_SOFT, display: 'flex' }}>intern-flow.in/tools</div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              color: PAPER,
              background: ACCENT,
              padding: '10px 20px',
              borderRadius: 8,
              display: 'flex',
            }}
          >
            Free tool
          </div>
        </div>
      </div>
    ),
    {
      width: WIDTH,
      height: HEIGHT,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
      },
    }
  );
}

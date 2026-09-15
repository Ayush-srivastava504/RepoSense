// Module: app/og/[filename]/route.tsx
// Defines component(s)/export(s): GET
//
// PHASE_PLAN.md Phase 3 item 3 — pre-generated OG images per job at
// /og/{id}.png, matching FresherFlow's approach. Every job-detail route
// previously fell back to the single static /og-image.png for every job
// (see lib/seo/ogImage.ts's comment) — this renders an actual per-job
// card (title / company / location / type) via Next's built-in
// `next/og` ImageResponse, so link previews for different jobs stop
// looking identical.
//
// "/og/{id}.png" (not "/og/{id}") is the literal URL shape the plan asked
// for. App Router route handlers can't match a literal ".png" suffix on a
// dynamic segment directly, so the folder captures the whole filename
// ("[filename]") and this parses the job id back out of it.
//
// "Cached rather than rendered per-crawl-hit" (the plan's phrasing) is
// handled via the Cache-Control header below rather than build-time
// static generation — job ids number in the thousands and change hourly,
// so pre-rendering every one at build time isn't viable the way
// generateStaticParams is for the curated skill/city/batch hub pages.
// Instead: a long `s-maxage` lets the CDN/edge cache serve every repeat
// crawl hit (Googlebot, Slack/Discord/Twitter unfurlers, etc.) straight
// from cache without re-invoking this handler, and `stale-while-revalidate`
// means a cache miss after the job's details change (e.g. deadline passes)
// still serves the last-known-good image immediately while a fresh one
// renders in the background, rather than blocking the crawler on a fresh
// render every time.

import { ImageResponse } from 'next/og';
import { getJobById } from '@/lib/jobs';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;

// Same palette as app/globals.css's light-mode --paper/--ink tokens.
// Route handlers can't import CSS custom properties, so these are
// duplicated as literal values — see globals.css if the brand palette
// changes.
const PAPER = '#faf9f6';
const INK = '#15171c';
const INK_SOFT = '#4a4d55';
const ACCENT = '#2f6f4f';
const LINE = '#e2ddcd';

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function fallbackImage() {
    return new ImageResponse((<div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: PAPER,
            fontFamily: 'sans-serif',
        }}>
      <div style={{ fontSize: 56, fontWeight: 700, color: INK }}>InternFlow</div>
      <div style={{ marginTop: 16, fontSize: 26, color: INK_SOFT }}>
        Live jobs &amp; internships for engineering students
      </div>
    </div>), {
        width: WIDTH,
        height: HEIGHT,
        headers: {
            // Shorter TTL than the per-job image below — this is the
            // fallback shown for a bad/expired id, worth re-checking sooner
            // in case the id starts resolving (e.g. right after a crawl).
            'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
    });
}

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
    const jobId = params.filename.replace(/\.png$/i, '');
    if (!jobId) {
        return fallbackImage();
    }
    const job = await getJobById(jobId);
    if (!job) {
        return fallbackImage();
    }

    const metaParts = [job.company];
    if (job.is_remote) {
        metaParts.push('Remote');
    } else if (job.location) {
        metaParts.push(job.location.split(',')[0].trim());
    }
    if (job.type) {
        metaParts.push(job.type === 'internship' ? 'Internship' : job.type[0].toUpperCase() + job.type.slice(1));
    }

    return new ImageResponse((<div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: PAPER,
            padding: '64px 72px',
            fontFamily: 'sans-serif',
        }}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{
                width: 14,
                height: 14,
                borderRadius: '50%',
                background: ACCENT,
                marginRight: 12,
                display: 'flex',
            }}/>
        <div style={{ fontSize: 28, fontWeight: 700, color: INK, display: 'flex' }}>InternFlow</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{
                fontSize: 56,
                fontWeight: 700,
                lineHeight: 1.15,
                color: INK,
                display: 'flex',
            }}>
          {truncate(job.title, 70)}
        </div>
        <div style={{ marginTop: 20, fontSize: 30, color: INK_SOFT, display: 'flex' }}>
          {truncate(metaParts.join(' · '), 90)}
        </div>
      </div>

      <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingTop: 32,
                borderTop: `2px solid ${LINE}`,
            }}>
        <div style={{ fontSize: 22, color: INK_SOFT, display: 'flex' }}>intern-flow.in</div>
        <div style={{
                fontSize: 20,
                fontWeight: 600,
                color: PAPER,
                background: ACCENT,
                padding: '10px 20px',
                borderRadius: 8,
                display: 'flex',
            }}>
          Apply now
        </div>
      </div>
    </div>), {
        width: WIDTH,
        height: HEIGHT,
        headers: {
            // Long CDN cache (30 days) with a week of stale-while-revalidate
            // grace — a job's title/company/location essentially never
            // change post-scrape, so an aggressively cached image is safe,
            // and this is exactly the "cached rather than rendered
            // per-crawl-hit" behavior the plan asked for.
            'Cache-Control': 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800',
        },
    });
}

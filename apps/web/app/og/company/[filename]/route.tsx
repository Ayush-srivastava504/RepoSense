// Module: app/og/company/[filename]/route.tsx
// Per-company share card at /og/company/{slug}.png (same pattern as app/og/[filename] for jobs).
// Shows only facts we already have: name, tier and live listing count. Falls back to the generic card.

import { ImageResponse } from 'next/og';
import { getCompanyBySlug } from '@/lib/companies';

export const runtime = 'edge';

const WIDTH = 1200;
const HEIGHT = 630;
const PAPER = '#faf9f6';
const INK = '#15171c';
const INK_SOFT = '#4a4d55';
const ACCENT = '#2f6f4f';
const LINE = '#e2ddcd';

const TIER_LABEL = { top: 'Top company', mass_hire: 'Mass hiring', startup: 'Startup' } as const;

function truncate(text: string, max: number): string {
    return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function card(title: string, subtitle: string, cache: string) {
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
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: ACCENT, marginRight: 12, display: 'flex' }}/>
        <div style={{ fontSize: 28, fontWeight: 700, color: INK, display: 'flex' }}>InternFlow</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.1, color: INK, display: 'flex' }}>{title}</div>
        <div style={{ marginTop: 20, fontSize: 32, color: INK_SOFT, display: 'flex' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 32, borderTop: `2px solid ${LINE}` }}>
        <div style={{ fontSize: 22, color: INK_SOFT, display: 'flex' }}>intern-flow.in</div>
        <div style={{ fontSize: 20, fontWeight: 600, color: PAPER, background: ACCENT, padding: '10px 20px', borderRadius: 8, display: 'flex' }}>
          Jobs &amp; internships
        </div>
      </div>
    </div>), { width: WIDTH, height: HEIGHT, headers: { 'Cache-Control': cache } });
}

export async function GET(_request: Request, { params }: { params: { filename: string } }) {
    const slug = params.filename.replace(/\.png$/i, '');
    const company = slug ? await getCompanyBySlug(slug).catch(() => null) : null;
    if (!company) {
        return card('InternFlow', 'Live jobs & internships for engineering students', 'public, max-age=3600, s-maxage=86400');
    }
    const n = company.job_count;
    const subtitle = `${TIER_LABEL[company.tier] ?? 'Company'} · ${n} active listing${n === 1 ? '' : 's'}`;
    return card(truncate(company.company, 40), subtitle, 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800');
}

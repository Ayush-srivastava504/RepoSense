// Module: app/components/ToolVideoGuide.tsx
// Server-rendered "see it in action" block for a tool page: the tool's screen recording, what it shows,
// and the page's VideoObject. Most tool pages render their UI client-side behind AuthGuard (nothing in
// the server HTML), so this block is also the crawlable description of the tool.
import { getToolVideo, videoObjectSchema } from '@/lib/toolVideos';
import { BASE_URL } from '@/lib/site';
import { safeJsonLd } from '@/lib/structuredData';
import VideoPlayer from './VideoPlayer';

export default function ToolVideoGuide({ slug, path, className = '' }: { slug: string; path?: string; className?: string }) {
    const v = getToolVideo(slug);
    const pageUrl = `${BASE_URL}${path ?? v.href}`;
    const headingId = `video-${v.slug}`;
    return (<section aria-labelledby={headingId} className={`border-t pt-10 ${className}`} style={{ borderColor: 'var(--line)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(videoObjectSchema(v, pageUrl)) }}/>
      <div className="grid items-center gap-8 md:grid-cols-5">
        <div className="md:col-span-3">
          <VideoPlayer video={v} frame="browser"/>
        </div>
        <div className="md:col-span-2">
          <p className="eyebrow eyebrow-accent mb-2">// see it in action</p>
          <h2 id={headingId} className="display text-2xl font-medium">{v.title}: how it works</h2>
          <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{v.body}</p>
          <ol className="mt-5 space-y-3">
            {v.steps.map((s, i) => (<li key={s} className="flex gap-3 text-sm">
                <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[11px] font-semibold" style={{ background: 'var(--indigo-soft)', color: 'var(--indigo)' }}>{i + 1}</span>
                <span className="pt-0.5">{s}</span>
              </li>))}
          </ol>
          <p className="mt-5 text-xs" style={{ color: 'var(--muted)' }}>
            {v.seconds}-second recording of the live tool, made with a sample resume. Free to use, no account needed.
          </p>
        </div>
      </div>
    </section>);
}

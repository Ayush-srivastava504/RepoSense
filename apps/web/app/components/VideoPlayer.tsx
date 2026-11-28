// Module: app/components/VideoPlayer.tsx
// One muted, looping screen recording. It loads and plays only while on screen (IntersectionObserver),
// so off-screen videos cost nothing. With reduced motion it shows the poster and plays only when tapped.
// `frame="browser"` wraps it in a simple browser window so it reads as the live product.
'use client';
import { useEffect, useRef, useState } from 'react';
import type { ToolVideo } from '@/lib/toolVideos';

interface Props {
    video: ToolVideo;
    frame?: 'browser' | 'plain';
    /** Above-the-fold video (homepage hero): fetch metadata up front instead of waiting. */
    priority?: boolean;
    className?: string;
}

export default function VideoPlayer({ video, frame = 'plain', priority = false, className = '' }: Props) {
    const ref = useRef<HTMLVideoElement>(null);
    const [playing, setPlaying] = useState(false);
    const [reduced, setReduced] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const el = ref.current;
        if (!el || mq.matches || typeof IntersectionObserver === 'undefined')
            return;
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
            }
            else {
                el.pause();
                setPlaying(false);
            }
        }, { threshold: 0.35 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const toggle = () => {
        const el = ref.current;
        if (!el)
            return;
        if (el.paused) {
            el.play().then(() => setPlaying(true)).catch(() => undefined);
        }
        else {
            el.pause();
            setPlaying(false);
        }
    };

    const player = (<div className="relative aspect-video w-full overflow-hidden" style={{ background: 'var(--paper-dim)' }}>
      <video ref={ref} className="h-full w-full object-cover object-top" src={`/videos/${video.slug}.mp4`} poster={`/videos/${video.slug}.jpg`} width={960} height={540} muted loop playsInline preload={priority ? 'metadata' : 'none'} aria-label={`${video.title}: ${video.seconds}-second screen recording`}/>
      <button type="button" onClick={toggle} className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-full shadow transition hover:scale-105" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }} aria-label={playing ? `Pause ${video.title} video` : `Play ${video.title} video`}>
        {playing
            ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>)
            : (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>)}
      </button>
      {reduced && !playing && <span className="sr-only">Video paused because reduced motion is on.</span>}
    </div>);

    if (frame === 'plain')
        return <div className={`overflow-hidden rounded-xl border ${className}`} style={{ borderColor: 'var(--line-strong)' }}>{player}</div>;

    return (<div className={`overflow-hidden rounded-2xl border ${className}`} style={{ borderColor: 'var(--line-strong)', background: 'var(--paper)', boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-center gap-3 border-b px-3 py-2" style={{ borderColor: 'var(--line)', background: 'var(--paper-dim)' }} aria-hidden="true">
        <span className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--rust)' }}/>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--score-amber)' }}/>
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: 'var(--green)' }}/>
        </span>
        <span className="truncate rounded-md px-2.5 py-0.5 text-[11px]" style={{ background: 'var(--paper)', color: 'var(--muted)', border: '1px solid var(--line)' }}>
          intern-flow.in{video.href}
        </span>
      </div>
      {player}
    </div>);
}

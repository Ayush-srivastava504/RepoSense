// Module: app/components/ToolVideos.tsx
// Homepage grid of short screen recordings, one per tool. Videos are muted, loop, and only load and play
// while on screen (IntersectionObserver), so they cost nothing until scrolled to. With reduced motion
// they show the poster and play only when tapped. Captions under each video describe what it shows.
'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ToolVideo } from '@/lib/toolVideos';

function VideoCard({ v }: { v: ToolVideo }) {
    const ref = useRef<HTMLVideoElement>(null);
    const [reduced, setReduced] = useState(false);
    const [playing, setPlaying] = useState(false);

    useEffect(() => {
        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        setReduced(mq.matches);
        const el = ref.current;
        if (!el || mq.matches || typeof IntersectionObserver === 'undefined')
            return;
        const io = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                el.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
            } else {
                el.pause();
                setPlaying(false);
            }
        }, { threshold: 0.4 });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    const toggle = () => {
        const el = ref.current;
        if (!el)
            return;
        if (el.paused) {
            el.play().then(() => setPlaying(true)).catch(() => undefined);
        } else {
            el.pause();
            setPlaying(false);
        }
    };

    return (<figure className="panel card-lift flex flex-col overflow-hidden">
      <div className="relative aspect-video w-full" style={{ background: 'var(--paper-dim)' }}>
        <video ref={ref} className="h-full w-full object-cover object-top" src={`/videos/${v.slug}.mp4`} poster={`/videos/${v.slug}.jpg`} muted loop playsInline preload="none" aria-label={`${v.title}: screen recording`}/>
        <button type="button" onClick={toggle} className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full text-xs shadow" style={{ background: 'var(--paper)', color: 'var(--ink)', border: '1px solid var(--line)' }} aria-label={playing ? `Pause ${v.title} video` : `Play ${v.title} video`}>
          {playing ? (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>) : (<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>)}
        </button>
        {reduced && !playing && (<span className="sr-only">Video paused because reduced motion is on.</span>)}
      </div>
      <figcaption className="flex flex-1 flex-col p-4">
        <h3 className="display text-base font-medium">{v.title}</h3>
        <p className="mt-1.5 flex-1 text-sm leading-relaxed" style={{ color: 'var(--ink-soft)' }}>{v.body}</p>
        <Link href={v.href} className="mt-3 text-sm font-medium" style={{ color: 'var(--indigo)' }}>Try it free →</Link>
      </figcaption>
    </figure>);
}

export default function ToolVideos({ videos }: { videos: ToolVideo[] }) {
    return (<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {videos.map((v) => (<VideoCard key={v.slug} v={v}/>))}
    </div>);
}

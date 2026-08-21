'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3315793616023053';

let adsenseScriptPromise: Promise<void> | null = null;

/**
 * Injects the AdSense loader script at most once, and only when an <AdSlot>
 * actually mounts. Previously this ~150-300 KiB script was hard-coded into
 * <head> in app/layout.tsx, so it downloaded, parsed, and ran on every
 * route — including pages with zero ad units, like the homepage. Lighthouse
 * flagged nearly all of it as "unused JavaScript" on those pages. Loading it
 * lazily, on demand, means pages without ads (home, blog, dashboard, etc.)
 * ship none of this JS at all.
 */
function loadAdsenseScript(): Promise<void> {
  if (adsenseScriptPromise) return adsenseScriptPromise;

  adsenseScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${ADSENSE_SRC}"]`
    );
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = ADSENSE_SRC;
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load AdSense script'));
    document.head.appendChild(script);
  });

  return adsenseScriptPromise;
}

/**
 * Renders a single Google AdSense ad unit.
 *
 * `slot` is the per-placement ad unit ID — create one in the AdSense
 * dashboard (Ads -> By ad unit -> Display ads) for each spot you want an ad
 * to appear (e.g. one for the dashboard sidebar, one for the jobs feed).
 * The publisher ID (ca-pub-...) is shared across all units.
 */
export default function AdSlot({
  slot,
  format = 'auto',
  className = '',
  style,
}: {
  slot: string;
  format?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const pushed = useRef(false);

  useEffect(() => {
    if (pushed.current) return;
    pushed.current = true;

    loadAdsenseScript()
      .then(() => {
        try {
          (window.adsbygoogle = window.adsbygoogle || []).push({});
        } catch (err) {
          // AdSense script may not be loaded yet (e.g. ad blocker) — fail silently
          console.error('AdSense push failed:', err);
        }
      })
      .catch((err) => console.error(err));
  }, []);

  return (
    <ins
      className={`adsbygoogle ${className}`}
      style={{ display: 'block', ...style }}
      data-ad-client="ca-pub-3315793616023053"
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive="true"
    />
  );
}

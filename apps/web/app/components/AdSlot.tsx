'use client';

import { useEffect, useRef } from 'react';

declare global {
  interface Window {
    adsbygoogle: any[];
  }
}

/**
 * Renders a single Google AdSense ad unit.
 *
 * `slot` is the per-placement ad unit ID — create one in the AdSense
 * dashboard (Ads -> By ad unit -> Display ads) for each spot you want an ad
 * to appear (e.g. one for the dashboard sidebar, one for the jobs feed).
 * The publisher ID (ca-pub-...) is shared across all units and is already
 * wired up in app/layout.tsx.
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
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch (err) {
      // AdSense script may not be loaded yet (e.g. ad blocker) — fail silently
      console.error('AdSense push failed:', err);
    }
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

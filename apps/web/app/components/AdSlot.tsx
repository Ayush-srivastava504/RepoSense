// Module: app/components/AdSlot.tsx
// Defines component(s)/export(s): AdSlot
//
// Reusable Google AdSense ad unit. The AdSense loader script is included once,
// site-wide, in app/layout.tsx <head>; this component only renders the <ins>
// unit and queues it. Until a real slot ID is supplied (see lib/adsense.ts) it
// renders nothing, so it is safe to place on pages before AdSense approval.

'use client';
import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT } from '@/lib/adsense';

declare global {
    interface Window {
        adsbygoogle: any[];
    }
}

export default function AdSlot({ slot, format = 'auto', className = '', style, }: {
    slot: string;
    format?: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const pushed = useRef(false);
    const enabled = /^\d{6,}$/.test(slot);
    useEffect(() => {
        if (!enabled || pushed.current)
            return;
        pushed.current = true;
        try {
            (window.adsbygoogle = window.adsbygoogle || []).push({});
        }
        catch (err) {
            console.error('AdSense push failed:', err);
        }
    }, [enabled]);
    if (!enabled)
        return null;
    return (<ins className={`adsbygoogle ${className}`} style={{ display: 'block', ...style }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true"/>);
}

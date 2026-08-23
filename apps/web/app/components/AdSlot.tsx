// Module: app/components/AdSlot.tsx
// Defines component(s)/export(s): ADSENSE_SRC, AdSlot
// Defines function(s): loadAdsenseScript
//

'use client';
import { useEffect, useRef } from 'react';
declare global {
    interface Window {
        adsbygoogle: any[];
    }
}
const ADSENSE_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3315793616023053';
let adsenseScriptPromise: Promise<void> | null = null;
function loadAdsenseScript(): Promise<void> {
    if (adsenseScriptPromise)
        return adsenseScriptPromise;
    adsenseScriptPromise = new Promise((resolve, reject) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${ADSENSE_SRC}"]`);
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
export default function AdSlot({ slot, format = 'auto', className = '', style, }: {
    slot: string;
    format?: string;
    className?: string;
    style?: React.CSSProperties;
}) {
    const pushed = useRef(false);
    useEffect(() => {
        if (pushed.current)
            return;
        pushed.current = true;
        loadAdsenseScript()
            .then(() => {
            try {
                (window.adsbygoogle = window.adsbygoogle || []).push({});
            }
            catch (err) {
                console.error('AdSense push failed:', err);
            }
        })
            .catch((err) => console.error(err));
    }, []);
    return (<ins className={`adsbygoogle ${className}`} style={{ display: 'block', ...style }} data-ad-client="ca-pub-3315793616023053" data-ad-slot={slot} data-ad-format={format} data-full-width-responsive="true"/>);
}

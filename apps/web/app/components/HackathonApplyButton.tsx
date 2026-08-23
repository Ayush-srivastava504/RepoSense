// Module: app/components/HackathonApplyButton.tsx
// Defines component(s)/export(s): HackathonApplyButton
//
//

'use client';
import { trackEvent } from '@/lib/analytics';
export default function HackathonApplyButton({ url, source, mode, }: {
    url: string;
    source?: string;
    mode?: string;
}) {
    const handleApply = () => {
        trackEvent('hackathon_apply_clicked', { source, mode });
        window.open(url, '_blank', 'noopener,noreferrer');
    };
    return (<button onClick={handleApply} className="mt-10 inline-block rounded-md px-6 py-3 text-sm font-medium" style={{ background: 'var(--ink)', color: 'var(--paper, #fff)' }}>
      Apply on Official Website ↗
    </button>);
}

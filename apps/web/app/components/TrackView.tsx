// Module: app/components/TrackView.tsx
// Defines component(s)/export(s): TrackView
//
//

'use client';
import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';
export default function TrackView({ event, params, }: {
    event: string;
    params?: Record<string, any>;
}) {
    useEffect(() => {
        trackEvent(event, params);
    }, [event]);
    return null;
}

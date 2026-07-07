'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/analytics';

export default function TrackView({
  event,
  params,
}: {
  event: string;
  params?: Record<string, any>;
}) {
  useEffect(() => {
    trackEvent(event, params);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event]);

  return null;
}

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/** Redirects signed-in (non-guest) users straight to the dashboard.
 *  Renders nothing — lets the parent page stay a server component. */
export default function AuthRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user && !user.is_guest) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  return null;
}

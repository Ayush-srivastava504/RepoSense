'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ensureGuestSession } from '@/lib/auth';
import { featureFlags } from '@/lib/featureFlags';

/**
 * Wrap any page that requires login with this component.
 *
 * Usage:
 *   export default function DashboardPage() {
 *     return (
 *       <AuthGuard>
 *         <DashboardContent />
 *       </AuthGuard>
 *     );
 *   }
 *
 * - NEXT_PUBLIC_REQUIRE_AUTH=false → mints a guest session behind the
 *   scenes (real DB row + JWT, no OTP) and renders children for everyone.
 *   No redirect, no signup wall.
 * - NEXT_PUBLIC_REQUIRE_AUTH=true  → normal gating:
 *     - While loading → renders nothing (prevents flash of protected content).
 *     - No token / expired token → redirects to /login immediately.
 *     - Valid token → renders children.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, refresh } = useAuth();
  const router = useRouter();
  const [guestReady, setGuestReady] = useState(featureFlags.requireAuth);

  useEffect(() => {
    if (featureFlags.requireAuth) return;
    let cancelled = false;
    (async () => {
      await ensureGuestSession();
      if (cancelled) return;
      refresh();
      setGuestReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  useEffect(() => {
    if (!featureFlags.requireAuth) return;
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  if (!featureFlags.requireAuth) {
    if (!guestReady) return null;
    return <>{children}</>;
  }

  if (loading || !user) return null;

  return <>{children}</>;
}
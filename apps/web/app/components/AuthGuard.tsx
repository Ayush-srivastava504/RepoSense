'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

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
 * - While loading → renders nothing (prevents flash of protected content).
 * - No token / expired token → redirects to /login immediately.
 * - Valid token → renders children.
 */
export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [loading, user, router]);

  // Don't render anything until we know the auth state.
  // This prevents the protected page from flashing before the redirect.
  if (loading || !user) return null;

  return <>{children}</>;
}
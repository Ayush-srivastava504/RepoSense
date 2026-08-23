// Module: app/components/AuthGuard.tsx
// Defines component(s)/export(s): AuthGuard
//
//

'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ensureGuestSession } from '@/lib/auth';
import { featureFlags } from '@/lib/featureFlags';
export default function AuthGuard({ children }: {
    children: React.ReactNode;
}) {
    const { user, loading, refresh } = useAuth();
    const router = useRouter();
    const [guestReady, setGuestReady] = useState(featureFlags.requireAuth);
    useEffect(() => {
        if (featureFlags.requireAuth)
            return;
        let cancelled = false;
        (async () => {
            await ensureGuestSession();
            if (cancelled)
                return;
            refresh();
            setGuestReady(true);
        })();
        return () => {
            cancelled = true;
        };
    }, [refresh]);
    useEffect(() => {
        if (!featureFlags.requireAuth)
            return;
        if (!loading && !user) {
            router.replace('/login');
        }
    }, [loading, user, router]);
    if (!featureFlags.requireAuth) {
        if (!guestReady)
            return null;
        return <>{children}</>;
    }
    if (loading || !user)
        return null;
    return <>{children}</>;
}

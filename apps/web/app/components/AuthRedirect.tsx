// Module: app/components/AuthRedirect.tsx
// Defines component(s)/export(s): AuthRedirect
//
//

'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
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

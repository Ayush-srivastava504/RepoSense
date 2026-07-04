'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from './auth';
import { featureFlags, GatedFeature } from './featureFlags';

export function useAuthGate() {
  const { user } = useAuth();
  const router = useRouter();

  const gate = (feature: GatedFeature, action: () => void, redirectTo = '/login') => {
    const requiresAuth = featureFlags[feature];
    if (requiresAuth && !user) {
      router.push(redirectTo);
      return false;
    }
    action();
    return true;
  };

  const isLocked = (feature: GatedFeature) => featureFlags[feature] && !user;

  return { user, gate, isLocked };
}
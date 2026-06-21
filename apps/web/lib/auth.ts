import { useState, useEffect, useCallback } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
}

function decodeUser(token: string): User | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      localStorage.removeItem('token');
      return null;
    }
    return {
      id: payload.sub,
      email: payload.email,
      subscription_tier: payload.subscription_tier ?? 'free',
    };
  } catch {
    localStorage.removeItem('token');
    return null;
  }
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(() => {
    const stored = localStorage.getItem('token');
    if (!stored) {
      setToken(null);
      setUser(null);
      return;
    }
    const decoded = decodeUser(stored);
    if (!decoded) {
      setToken(null);
      setUser(null);
      return;
    }
    setToken(stored);
    setUser(decoded);
  }, []);

  useEffect(() => {
    refresh();
    setLoading(false);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  /**
   * Step 1: Request OTP sent to email.
   * Returns nothing — just triggers the email.
   */
  const requestOtp = async (email: string) => {
    await api.post('/auth/otp/request', { email });
  };

  /**
   * Step 2: Verify OTP and get JWT.
   */
  const verifyOtp = async (email: string, otp: string) => {
    const data = await api.post('/auth/otp/verify', { email, otp });
    localStorage.setItem('token', data.access_token);
    refresh();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return { token, user, loading, requestOtp, verifyOtp, logout, refresh };
}
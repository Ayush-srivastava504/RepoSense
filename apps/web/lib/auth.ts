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

  // Re-reads the token from localStorage and syncs React state.
  // Call this any time something writes to localStorage directly
  // outside of login()/logout() — e.g. the GitHub OAuth callback
  // page, which stores a token it received via a redirect query
  // param rather than through the login() flow.
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

    // Keep state in sync if the token changes in another tab/window.
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);
    refresh();
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return { token, user, loading, login, logout, refresh };
}
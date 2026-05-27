import { useState, useEffect } from 'react';
import { api } from './api';

interface User {
  id: string;
  email: string;
  subscription_tier: 'free' | 'pro' | 'enterprise';
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('token');
    if (stored) {
      setToken(stored);
      try {
        const payload = JSON.parse(atob(stored.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('token');
          setLoading(false);
          return;
        }
        setUser({
          id: payload.sub,
          email: payload.email,
          subscription_tier: payload.subscription_tier ?? 'free',
        });
      } catch {
        localStorage.removeItem('token');
      }
    }
    setLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const data = await api.post('/auth/login', { email, password });
    const t = data.access_token;
    localStorage.setItem('token', t);
    setToken(t);
    const payload = JSON.parse(atob(t.split('.')[1]));
    setUser({
      id: payload.sub,
      email: payload.email,
      subscription_tier: payload.subscription_tier ?? 'free',
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return { token, user, loading, login, logout };
}
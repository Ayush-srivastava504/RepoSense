'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import Link from 'next/link';
import Logo from '../components/Logo';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', { email, password });
      router.push('/login');
    } catch (err: any) {
      setError(err?.message || 'Could not create your account. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="shell flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <div className="panel w-full max-w-sm p-8">
        <p className="eyebrow eyebrow-accent">// create account</p>
        <h1 className="display mt-2 text-2xl font-medium">Set up InternFlow</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="field-label" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@school.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="field-label" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          {error && (
            <p className="chip chip-rust !inline-block w-full !justify-start" role="alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={loading} className="btn btn-primary w-full">
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          Already have one?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--indigo)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
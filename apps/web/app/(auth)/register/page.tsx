'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Logo from '../../components/Logo';

type Step = 'email' | 'otp';

export default function Register() {
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { requestOtp, verifyOtp } = useAuth();
  const router = useRouter();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Register endpoint creates the user (or is a no-op if they already exist)
      // then sends OTP
      await requestOtp(email);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || 'Could not create your account. Try a different email.');
    } finally {
      setLoading(false);
    }
  };

  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await verifyOtp(email, otp);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired code. Try again.');
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
        {step === 'email' ? (
          <>
            <p className="eyebrow eyebrow-accent">// create account</p>
            <h1 className="display mt-2 text-2xl font-medium">Set up InternFlow</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              No password needed — we'll verify you by email.
            </p>
            <form onSubmit={handleEmailSubmit} className="mt-6 space-y-4">
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
              {error && (
                <p className="chip chip-rust !inline-block w-full !justify-start" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Sending code...' : 'Send verification code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow eyebrow-accent">// verify email</p>
            <h1 className="display mt-2 text-2xl font-medium">Check your inbox</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              We sent a 6-digit code to <strong>{email}</strong>.
            </p>
            <form onSubmit={handleOtpSubmit} className="mt-6 space-y-4">
              <div>
                <label className="field-label" htmlFor="otp">
                  One-time code
                </label>
                <input
                  id="otp"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  className="field tracking-widest text-center text-lg"
                  required
                  autoComplete="one-time-code"
                  autoFocus
                />
              </div>
              {error && (
                <p className="chip chip-rust !inline-block w-full !justify-start" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Verifying...' : 'Create account'}
              </button>
              <button
                type="button"
                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                className="btn btn-ghost w-full"
              >
                Use a different email
              </button>
            </form>
          </>
        )}

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
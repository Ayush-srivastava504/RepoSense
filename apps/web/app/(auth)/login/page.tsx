'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import Link from 'next/link';
import Logo from '../../components/Logo';

type Step = 'email' | 'otp';

export default function Login() {
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
      await requestOtp(email);
      setStep('otp');
    } catch (err: any) {
      setError(err?.message || "Couldn't send OTP. Check your email address.");
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
            <p className="eyebrow eyebrow-accent">// sign in</p>
            <h1 className="display mt-2 text-2xl font-medium">Welcome back</h1>
            <p className="mt-2 text-sm" style={{ color: 'var(--ink-soft)' }}>
              We'll send a one-time code to your email.
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
                {loading ? 'Sending code...' : 'Send code'}
              </button>
            </form>
          </>
        ) : (
          <>
            <p className="eyebrow eyebrow-accent">// verify</p>
            <h1 className="display mt-2 text-2xl font-medium">Check your email</h1>
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
                {loading ? 'Verifying...' : 'Verify & sign in'}
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
          New here?{' '}
          <Link href="/register" className="font-semibold" style={{ color: 'var(--indigo)' }}>
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
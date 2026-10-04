// Module: app/(auth)/register/page.tsx
// Defines component(s)/export(s): Register
// Defines type(s): Step
//

'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, ensureGuestSession } from '@/lib/auth';
import { featureFlags } from '@/lib/featureFlags';
import Link from 'next/link';
import Logo from '../../components/Logo';
import { trackSignUp, trackFunnelStep, trackEvent } from '@/lib/analytics';

type Step = 'email' | 'otp';
export default function Register() {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [guestLoading, setGuestLoading] = useState(false);
    const { requestOtp, verifyOtp, refresh } = useAuth();
    const router = useRouter();
    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await requestOtp(email);
            trackFunnelStep({ funnel: 'sign_up', step: 'otp_requested', step_index: 1 });
            setStep('otp');
        }
        catch (err: any) {
            setError(err?.message || 'Could not create your account. Try a different email.');
        }
        finally {
            setLoading(false);
        }
    };
    const handleGuestStart = async () => {
        setError('');
        setGuestLoading(true);
        try {
            await ensureGuestSession();
            if (!localStorage.getItem('token')) {
                throw new Error('Could not start a free session. Try again or sign up with your email.');
            }
            refresh();
            trackEvent('guest_start_free', { source: 'register' });
            router.push('/dashboard');
        }
        catch (err: any) {
            setError(err?.message || 'Could not start a free session. Try again.');
        }
        finally {
            setGuestLoading(false);
        }
    };
    const handleOtpSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            await verifyOtp(email, otp);
            trackSignUp('email');
            router.push('/dashboard');
        }
        catch (err: any) {
            setError(err?.message || 'Invalid or expired code. Try again.');
        }
        finally {
            setLoading(false);
        }
    };
    return (<div className="shell flex min-h-screen flex-col items-center justify-center px-6">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <div className="panel w-full max-w-sm p-8">
        {step === 'email' ? (<>
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
                <input id="email" type="email" placeholder="you@school.edu" value={email} onChange={(e) => setEmail(e.target.value)} className="field" required autoComplete="email"/>
              </div>
              {error && (<p className="chip chip-rust !inline-block w-full !justify-start" role="alert">
                  {error}
                </p>)}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Sending code...' : 'Send verification code'}
              </button>
            </form>
            {!featureFlags.requireAuth && (<>
                <div className="my-5 flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                  <span className="h-px flex-1" style={{ background: 'var(--line)' }}/>
                  or
                  <span className="h-px flex-1" style={{ background: 'var(--line)' }}/>
                </div>
                <button type="button" onClick={handleGuestStart} disabled={guestLoading || loading} className="btn btn-secondary w-full">
                  {guestLoading ? 'Starting...' : 'Get started free'}
                </button>
                <p className="mt-2 text-center text-xs" style={{ color: 'var(--muted)' }}>
                  No email or card needed. Create an account any time.
                </p>
              </>)}
          </>) : (<>
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
                <input id="otp" type="text" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} placeholder="123456" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} className="field tracking-widest text-center text-lg" required autoComplete="one-time-code" autoFocus/>
              </div>
              {error && (<p className="chip chip-rust !inline-block w-full !justify-start" role="alert">
                  {error}
                </p>)}
              <button type="submit" disabled={loading} className="btn btn-primary w-full">
                {loading ? 'Verifying...' : 'Create account'}
              </button>
              <button type="button" onClick={() => { setStep('email'); setOtp(''); setError(''); }} className="btn btn-ghost w-full">
                Use a different email
              </button>
            </form>
          </>)}

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--ink-soft)' }}>
          Already have one?{' '}
          <Link href="/login" className="font-semibold" style={{ color: 'var(--indigo)' }}>
            Sign in
          </Link>
        </p>
      </div>

    </div>);
}
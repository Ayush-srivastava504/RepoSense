'use client';
// Segment error boundary for /companies/[company]: a rendering failure shows a friendly page with a retry
// instead of the generic "Application error" screen, and the error is logged with its digest for the server logs.
import Link from 'next/link';
import { useEffect } from 'react';

export default function CompanyError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    useEffect(() => {
        console.error('Company page error', error.digest, error);
    }, [error]);
    return (<main className="mx-auto w-full max-w-3xl px-4 py-16 text-center">
      <h1 className="display text-2xl font-medium">This company page could not be loaded</h1>
      <p className="mt-3 text-sm" style={{ color: 'var(--ink-soft)' }}>Something went wrong on our side. Try again, or browse other companies.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={() => reset()} className="btn px-4 py-2 text-sm">Try again</button>
        <Link href="/companies" className="btn px-4 py-2 text-sm">All companies</Link>
      </div>
    </main>);
}

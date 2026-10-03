'use client';
// Last-resort boundary: catches errors thrown in the root layout, which segment error.tsx files cannot.
// Without it the visitor sees Next's bare "500 Internal Server Error." page.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
    console.error('Global error', error.digest, error);
    return (<html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', textAlign: 'center', padding: '4rem 1rem' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Something went wrong</h1>
        <p style={{ marginTop: '.75rem', color: '#555' }}>Please try again, or head back to the home page.</p>
        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '.75rem', justifyContent: 'center' }}>
          <button type="button" onClick={() => reset()} style={{ padding: '.5rem 1rem' }}>Try again</button>
          <a href="/" style={{ padding: '.5rem 1rem' }}>Home</a>
        </div>
      </body>
    </html>);
}

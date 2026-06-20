'use client';

import dynamic from 'next/dynamic';

const CommitGraph3D = dynamic(() => import('./CommitGraph3D'), {
  ssr: false,
  loading: () => <GraphFallback />,
});

function GraphFallback() {
  return (
    <svg viewBox="0 0 320 220" className="h-full w-full" aria-hidden="true">
      <line x1="20" y1="110" x2="120" y2="110" stroke="#cfc8b2" strokeWidth="2" />
      <line x1="200" y1="110" x2="300" y2="110" stroke="#cfc8b2" strokeWidth="2" />
      <path d="M120 110 C 160 50, 180 50, 200 110" stroke="#3a3ad6" strokeWidth="2" fill="none" />
      <circle cx="20" cy="110" r="6" fill="#2e6f4f" />
      <circle cx="120" cy="110" r="7" fill="#15171c" />
      <circle cx="160" cy="65" r="5" fill="#3a3ad6" />
      <circle cx="200" cy="110" r="7" fill="#15171c" />
      <circle cx="300" cy="110" r="6" fill="#2e6f4f" />
    </svg>
  );
}

export default function HeroGraph() {
  return <CommitGraph3D />;
}
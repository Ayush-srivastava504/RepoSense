'use client';

import { useMemo } from 'react';

type Particle = {
  top: string;
  left: string;
  size: number;
  duration: number;
  delay: number;
  drift: { x: number; y: number };
  opacity: number;
  color: 'indigo' | 'green' | 'rust';
};

const COLOR_VAR: Record<Particle['color'], string> = {
  indigo: 'var(--indigo)',
  green: 'var(--green)',
  rust: 'var(--rust)',
};

function makeParticles(count: number): Particle[] {
  const colors: Particle['color'][] = ['indigo', 'green', 'rust'];
  // Deterministic pseudo-random so server and client render the same markup.
  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  return Array.from({ length: count }, (_, i) => ({
    top: `${Math.round(rand() * 90)}%`,
    left: `${Math.round(rand() * 96)}%`,
    size: 3 + Math.round(rand() * 5),
    duration: 7 + Math.round(rand() * 8),
    delay: Math.round(rand() * 6 * 10) / 10,
    drift: { x: Math.round((rand() - 0.5) * 60), y: -(14 + Math.round(rand() * 26)) },
    opacity: 0.25 + rand() * 0.35,
    color: colors[i % colors.length],
  }));
}

/**
 * Sits absolutely inside a `position: relative` container and renders a
 * slow-drifting gradient wash plus a handful of floating particles.
 * Purely decorative — marked aria-hidden.
 */
export default function AuroraBackground({ particleCount = 14 }: { particleCount?: number }) {
  const particles = useMemo(() => makeParticles(particleCount), [particleCount]);

  return (
    <div aria-hidden="true">
      <div className="bg-aurora" />
      <div className="bg-particles">
        {particles.map((p, i) => (
          <span
            key={i}
            style={
              {
                top: p.top,
                left: p.left,
                '--particle-size': `${p.size}px`,
                '--particle-dur': `${p.duration}s`,
                '--particle-delay': `${p.delay}s`,
                '--particle-x': `${p.drift.x}px`,
                '--particle-y': `${p.drift.y}px`,
                '--particle-o': p.opacity,
                '--particle-color': COLOR_VAR[p.color],
              } as React.CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}

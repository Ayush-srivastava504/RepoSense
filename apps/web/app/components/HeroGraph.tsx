// Module: app/components/HeroGraph.tsx
// Defines component(s)/export(s): HeroGraph
// A simple, static SVG hub-and-spoke graph: InternFlow at the center,
// connected to the four things the platform actually does.
//

const nodes = [
  { label: 'Jobs', x: 200, y: 66, color: '#60A5FA' },
  { label: 'Internships', x: 334, y: 200, color: '#34D399' },
  { label: 'Remote', x: 200, y: 334, color: '#F472B6' },
  { label: 'Resume', x: 66, y: 200, color: '#FB923C' },
];

export default function HeroGraph() {
  const cx = 200;
  const cy = 200;

  return (
    <div className="relative flex h-full w-full items-center justify-center">
      <svg viewBox="0 0 400 400" className="h-full w-full" style={{ maxWidth: 420 }}>
        {/* spokes */}
        {nodes.map((n) => (
          <line
            key={`line-${n.label}`}
            x1={cx}
            y1={cy}
            x2={n.x}
            y2={n.y}
            stroke="var(--line-strong)"
            strokeWidth="1.5"
            opacity="0.7"
          />
        ))}

        {/* satellite nodes */}
        {nodes.map((n) => (
          <g key={n.label}>
            <circle cx={n.x} cy={n.y} r="34" fill={n.color} opacity="0.14" />
            <circle cx={n.x} cy={n.y} r="24" fill={n.color} />
            <text
              x={n.x}
              y={n.y + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="#fff"
            >
              {n.label}
            </text>
          </g>
        ))}

        {/* center hub */}
        <circle cx={cx} cy={cy} r="56" fill="var(--indigo)" className="hero-graph-hub" />
        <text x={cx} y={cy - 3} textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">
          InternFlow
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" fontSize="9" fill="rgba(255,255,255,0.75)">
          career platform
        </text>
      </svg>

      <style>{`
        @keyframes heroGraphPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.85; }
        }
        .hero-graph-hub {
          animation: heroGraphPulse 3.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-graph-hub { animation: none; }
        }
      `}</style>
    </div>
  );
}

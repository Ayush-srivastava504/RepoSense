// The hero signature element: a small git history rendered as a graph. A main branch runs
// straight through; a second branch (the "AI review" branch, in indigo) splits off and
// merges back in — which is exactly what this product does to a real repo. Previously this
// mounted @react-three/fiber + drei + three.js just to spin a handful of icosahedrons — ~300

export default function HeroGraph() {
    return (<div className="hero-graph-spin h-full w-full" aria-hidden="true">
      <svg viewBox="0 0 320 220" className="h-full w-full">
        <line x1="20" y1="110" x2="120" y2="110" stroke="#cfc8b2" strokeWidth="2"/>
        <line x1="200" y1="110" x2="300" y2="110" stroke="#cfc8b2" strokeWidth="2"/>
        <path d="M120 110 C 160 50, 180 50, 200 110" stroke="#3a3ad6" strokeWidth="2" fill="none"/>
        <circle cx="20" cy="110" r="6" fill="#2e6f4f"/>
        <circle cx="120" cy="110" r="7" fill="#15171c"/>
        <circle cx="160" cy="65" r="5" fill="#3a3ad6"/>
        <circle cx="200" cy="110" r="7" fill="#15171c"/>
        <circle cx="300" cy="110" r="6" fill="#2e6f4f"/>
      </svg>
    </div>);
}

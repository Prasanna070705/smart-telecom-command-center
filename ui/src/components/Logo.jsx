// Animated logo: a radio mast broadcasting signal arcs (in sequence, forever), a satellite orbiting it, and the
// wordmark with a slow light sheen. Motion lives in index.css (.logo-*) and stops under prefers-reduced-motion.
// public/favicon.svg is the same mark, still.

const ARCS = [6, 10, 14]   // radii; each lights up 0.3 s after the one inside it
const arc = (r, side) => {
  const dx = (r * 0.766).toFixed(2), dy = (r * 0.643).toFixed(2)          // ±40° around the horizontal
  return side > 0 ? `M${20 + +dx} ${20 - dy}A${r} ${r} 0 0 1 ${20 + +dx} ${20 + +dy}` : `M${20 - dx} ${20 - dy}A${r} ${r} 0 0 0 ${20 - dx} ${20 + +dy}`
}

export function LogoMark({ className = 'h-10 w-10' }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="10" fill="url(#logo-tile)" />
      <circle cx="20" cy="20" r="17" fill="none" stroke="white" strokeOpacity="0.14" strokeDasharray="1.5 3" />
      <g className="logo-orbit"><circle cx="37" cy="20" r="1.6" fill="white" /></g>
      {ARCS.map((r, i) => [1, -1].map((side) => (
        <path key={`${r}${side}`} d={arc(r, side)} fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"
          className="logo-arc" style={{ '--d': `${i * 0.3}s` }} />
      )))}
      <path d="M20 22.5L16.5 32M20 22.5L23.5 32M17.6 29h4.8" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="20" cy="20" r="2.6" fill="white" className="logo-core" />
    </svg>
  )
}

export function Logo() {
  return (
    <div className="flex items-center gap-3">
      <LogoMark />
      <div>
        <p className="logo-sheen text-xs font-semibold uppercase tracking-widest">Smart Telecom</p>
        <p className="mt-0.5 text-lg font-semibold leading-tight text-white">Command Center</p>
      </div>
    </div>
  )
}

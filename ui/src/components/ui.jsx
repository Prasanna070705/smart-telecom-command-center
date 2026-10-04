// Shared building blocks. Class names are always complete strings so Tailwind can detect them.
export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/70 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

const KPI_TONES = { slate: 'text-slate-900 dark:text-slate-100', indigo: 'text-indigo-600 dark:text-indigo-400', emerald: 'text-emerald-600 dark:text-emerald-400', amber: 'text-amber-600 dark:text-amber-400', rose: 'text-rose-600 dark:text-rose-400' }
export function Kpi({ label, value, hint, tone = 'slate' }) {
  return (
    <div className="rounded-2xl bg-white/70 backdrop-blur-sm dark:bg-slate-900/70 p-5 shadow-sm ring-1 ring-slate-200 dark:ring-slate-800">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400">{label}</p>
      <p key={value} className={`fade-up mt-2 text-2xl font-semibold tabular-nums ${KPI_TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{hint}</p>}
    </div>
  )
}

const BUTTON_TONES = { indigo: 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600', emerald: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600', amber: 'bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600' }
export function Button({ children, onClick, busy, tone = 'indigo' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ${BUTTON_TONES[tone]}`}>
      {busy && <Spinner />}{children}
    </button>
  )
}

export function CancelButton({ onClick }) {
  return <button type="button" onClick={onClick} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 ring-1 ring-slate-300 dark:ring-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800">Cancel</button>
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
}

const BADGE_TONES = { slate: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300', indigo: 'bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300', emerald: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', amber: 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300', rose: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300' }
export function Badge({ children, tone = 'slate' }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>
}

export function Slider({ label, value, min, max, step, onChange, format = (v) => v, help }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} className="range mt-3 w-full" style={{ '--pct': `${(100 * (value - min)) / (max - min)}%` }} />
      {help && <span className="mt-1 block text-[11px] text-slate-600 dark:text-slate-400">{help}</span>}
    </label>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
    </label>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <p role="alert" className="rounded-lg bg-rose-50 dark:bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 ring-1 ring-rose-200 dark:ring-rose-500/30">{error}</p>
}

export function Empty({ children }) {
  return <div className="grid h-40 place-items-center rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">{children}</div>
}

export function Loading({ children }) {
  return (
    <div role="status" className="flex h-40 items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 text-sm text-slate-600 dark:text-slate-400">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 dark:border-slate-600 border-t-slate-600" aria-hidden="true" />{children}
    </div>
  )
}

// Shown when the integer solver stopped at its time limit, so the list is the best found, not proven within the gap.
// count = how many of several solves stopped (robustness, coupling); gapPct = the single solve's distance from the LP bound.
export function TimeLimitNote({ seconds, gapPct, count, of }) {
  const limit = seconds ? `${seconds} s solver time limit` : 'solver time limit'
  return (
    <p role="note" className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30">
      {count ? `${count} of ${of} solves stopped at the ${limit}; their values are the best found in that time, not proven within the gap.`
        : <>Stopped at the {limit}{gapPct != null && <>: this call list is within {gapPct.toFixed(3)}% of the best possible</>}.</>}
      {' '}A faster machine or a longer limit closes the gap.
    </p>
  )
}

// Shown over a result whose settings no longer match the page, so a stale number is never read as current.
export function StaleNote({ show }) {
  if (!show) return null
  return <p className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-500/15 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 ring-1 ring-amber-200 dark:ring-amber-500/30">Settings changed since this run. Run again to update.</p>
}

// Loading and error state for pages that need the data summary.
export function MetaGate({ meta, status, children }) {
  if (meta) return children
  if (status === 'unreachable') return <ErrorNote error="Cannot reach the API on this address. Start it with: npm run api (retrying every 1.5 s)." />
  return <Loading>{status === 'starting' ? 'Engines starting, loading the data summary…' : 'Loading the data summary…'}</Loading>
}

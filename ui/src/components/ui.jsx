// Shared building blocks. Class names are always complete strings so Tailwind can detect them.
export function Card({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 ${className}`}>
      {(title || action) && (
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
            {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  )
}

const KPI_TONES = { slate: 'text-slate-900', indigo: 'text-indigo-600', emerald: 'text-emerald-600', amber: 'text-amber-600', rose: 'text-rose-600' }
export function Kpi({ label, value, hint, tone = 'slate' }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${KPI_TONES[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  )
}

const BUTTON_TONES = { indigo: 'bg-indigo-600 hover:bg-indigo-500 focus-visible:outline-indigo-600', emerald: 'bg-emerald-600 hover:bg-emerald-500 focus-visible:outline-emerald-600', amber: 'bg-amber-600 hover:bg-amber-500 focus-visible:outline-amber-600' }
export function Button({ children, onClick, busy, tone = 'indigo' }) {
  return (
    <button type="button" onClick={onClick} disabled={busy}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 ${BUTTON_TONES[tone]}`}>
      {busy && <Spinner />}{children}
    </button>
  )
}

export function CancelButton({ onClick }) {
  return <button type="button" onClick={onClick} className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50">Cancel</button>
}

export function Spinner() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
}

const BADGE_TONES = { slate: 'bg-slate-100 text-slate-700', indigo: 'bg-indigo-50 text-indigo-700', emerald: 'bg-emerald-50 text-emerald-700', amber: 'bg-amber-50 text-amber-800', rose: 'bg-rose-50 text-rose-700' }
export function Badge({ children, tone = 'slate' }) {
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>
}

export function Slider({ label, value, min, max, step, onChange, format = (v) => v, help }) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <span className="text-xs font-semibold tabular-nums text-slate-900">{format(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))} className="mt-2 w-full accent-indigo-600" />
      {help && <span className="mt-1 block text-[11px] text-slate-400">{help}</span>}
    </label>
  )
}

export function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3">
      <span className="text-xs font-medium text-slate-600">{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
    </label>
  )
}

export function ErrorNote({ error }) {
  if (!error) return null
  return <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 ring-1 ring-rose-200">{error}</p>
}

export function Empty({ children }) {
  return <div className="grid h-40 place-items-center rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">{children}</div>
}

export function Loading({ children }) {
  return (
    <div role="status" className="flex h-40 items-center justify-center gap-3 rounded-xl border border-dashed border-slate-200 text-sm text-slate-500">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" aria-hidden="true" />{children}
    </div>
  )
}

// Shown over a result whose settings no longer match the page, so a stale number is never read as current.
export function StaleNote({ show }) {
  if (!show) return null
  return <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 ring-1 ring-amber-200">Settings changed since this run. Run again to update.</p>
}

// Loading and error state for pages that need the data summary.
export function MetaGate({ meta, status, children }) {
  if (meta) return children
  if (status === 'unreachable') return <ErrorNote error="Cannot reach the API on this address. Start it with: npm run api (retrying every 1.5 s)." />
  return <Loading>{status === 'starting' ? 'Engines starting, loading the data summary…' : 'Loading the data summary…'}</Loading>
}

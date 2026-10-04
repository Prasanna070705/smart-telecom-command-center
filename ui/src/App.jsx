import { useEffect, useState } from 'react'
import { api } from './api.js'
import Overview from './pages/Overview.jsx'
import Pricing from './pages/Pricing.jsx'
import Retention from './pages/Retention.jsx'
import Coupling from './pages/Coupling.jsx'
import Checks from './pages/Checks.jsx'
import { SharedSettings } from './components/SharedSettings.jsx'
import { SHARED_DEFAULTS } from './settings.js'

const PAGES = [
  { id: 'overview', label: 'Overview', title: 'Customer base at a glance', dot: 'bg-slate-400' },
  { id: 'pricing', label: 'Pricing', title: 'Engine 1 · Price optimizer', dot: 'bg-indigo-500' },
  { id: 'retention', label: 'Retention', title: 'Engine 2 · Offer optimizer', dot: 'bg-emerald-500' },
  { id: 'coupling', label: 'Coupling', title: 'Retention spend vs pricing room', dot: 'bg-amber-500' },
  { id: 'checks', label: 'Data & checks', title: 'Verification and assumptions', dot: 'bg-rose-400' },
]

const STATUS = {
  connecting: { label: 'Connecting', pill: 'bg-slate-100 text-slate-700', dot: 'bg-slate-400' },
  starting: { label: 'Engines starting', pill: 'bg-amber-50 text-amber-800', dot: 'bg-amber-500' },
  unreachable: { label: 'API not reachable', pill: 'bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  ready: { label: 'Engines ready', pill: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
}

export default function App() {
  const [page, setPage] = useState('overview')
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('connecting')     // connecting -> starting -> ready, or unreachable after ~12 s
  const [shared, setShared] = useState(SHARED_DEFAULTS)
  useEffect(() => {
    let alive = true; let tries = 0
    const load = async () => {
      try { const m = await api.meta(); if (alive) { setMeta(m); setStatus('ready') } }
      catch { if (alive) { tries += 1; setStatus(tries >= 8 ? 'unreachable' : 'starting'); setTimeout(load, 1500) } }
    }
    load(); return () => { alive = false }
  }, [])
  const current = PAGES.find((p) => p.id === page)
  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 px-4 py-6 text-slate-300 md:flex">
        <div className="px-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-300">Smart Telecom</p>
          <p className="mt-1 text-lg font-semibold text-white">Command Center</p>
        </div>
        <nav className="mt-8 space-y-1" aria-label="Main">
          {PAGES.map((p) => (
            <button key={p.id} type="button" onClick={() => setPage(p.id)} aria-current={page === p.id ? 'page' : undefined}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-indigo-400 ${page === p.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
              <span className={`h-2 w-2 rounded-full ${p.dot}`} />{p.label}
            </button>
          ))}
        </nav>
        <p className="mt-auto px-2 text-xs text-slate-500">Team AA11 · Operations Research</p>
      </aside>
      <main className="flex-1">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white/80 px-8 py-5 backdrop-blur">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{current.label}</p>
            <h1 className="text-xl font-semibold text-slate-900">{current.title}</h1>
          </div>
          <span role="status" className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${STATUS[status].pill}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${STATUS[status].dot}`} />{STATUS[status].label}
          </span>
        </header>
        <div className="px-8 py-8">
          {/* Pages stay mounted so results survive tab switches. */}
          {['pricing', 'retention', 'coupling'].includes(page) && <div className="mb-6"><SharedSettings value={shared} onChange={setShared} /></div>}
          <div hidden={page !== 'overview'}><Overview meta={meta} status={status} /></div>
          <div hidden={page !== 'pricing'}><Pricing shared={shared} /></div>
          <div hidden={page !== 'retention'}><Retention shared={shared} /></div>
          <div hidden={page !== 'coupling'}><Coupling shared={shared} /></div>
          <div hidden={page !== 'checks'}><Checks meta={meta} status={status} /></div>
        </div>
      </main>
    </div>
  )
}

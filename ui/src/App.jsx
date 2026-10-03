import { useEffect, useState } from 'react'
import { api } from './api.js'
import Overview from './pages/Overview.jsx'
import Pricing from './pages/Pricing.jsx'
import Retention from './pages/Retention.jsx'
import Coupling from './pages/Coupling.jsx'
import Checks from './pages/Checks.jsx'

const PAGES = [
  { id: 'overview', label: 'Overview', title: 'Customer base at a glance', dot: 'bg-slate-400' },
  { id: 'pricing', label: 'Pricing', title: 'Engine 1 · Price optimizer', dot: 'bg-indigo-500' },
  { id: 'retention', label: 'Retention', title: 'Engine 2 · Offer optimizer', dot: 'bg-emerald-500' },
  { id: 'coupling', label: 'Coupling', title: 'Retention spend vs pricing room', dot: 'bg-amber-500' },
  { id: 'checks', label: 'Data & checks', title: 'Verification and assumptions', dot: 'bg-rose-400' },
]

export default function App() {
  const [page, setPage] = useState('overview')
  const [meta, setMeta] = useState(null)
  const [status, setStatus] = useState('connecting')
  useEffect(() => {
    let alive = true
    const load = async () => {
      try { const m = await api.meta(); if (alive) { setMeta(m); setStatus('ready') } }
      catch { if (alive) { setStatus('starting'); setTimeout(load, 1500) } }
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
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${page === p.id ? 'bg-white/10 text-white' : 'hover:bg-white/5 hover:text-white'}`}>
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
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${status === 'ready' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${status === 'ready' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
            {status === 'ready' ? 'Engines ready' : 'Engines starting'}
          </span>
        </header>
        <div className="px-8 py-8">
          {/* Pages stay mounted so results survive tab switches. */}
          <div hidden={page !== 'overview'}><Overview meta={meta} /></div>
          <div hidden={page !== 'pricing'}><Pricing /></div>
          <div hidden={page !== 'retention'}><Retention /></div>
          <div hidden={page !== 'coupling'}><Coupling /></div>
          <div hidden={page !== 'checks'}><Checks meta={meta} /></div>
        </div>
      </main>
    </div>
  )
}

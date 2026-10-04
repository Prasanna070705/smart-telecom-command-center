import { useState } from 'react'
import { api } from '../api.js'
import { Card, Kpi, Button, Slider, Toggle, Badge, ErrorNote, Empty, Loading, StaleNote } from '../components/ui.jsx'
import { pick } from '../settings.js'
import { money, pct } from '../format.js'

function ChangeBar({ value }) {        // diverging bar, centre = no change, ends = ±25%
  const w = Math.min(Math.abs(value), 25) * 2
  return (
    <div className="relative h-2 w-32 rounded-full bg-slate-100">
      <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
      <div className={`absolute inset-y-0 rounded-full ${value >= 0 ? 'left-1/2 bg-indigo-500' : 'right-1/2 bg-rose-500'}`} style={{ width: `${w}%` }} />
    </div>
  )
}

const ETAS = [0.4, 0.8, 1.2, 1.5]

// Re-solves Engine 1 at four price sensitivities with the page's other settings, and says whether the price pattern holds.
function SensitivityPanel({ settings }) {
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [ran, setRan] = useState(null)
  const { eta: _eta, ...rest } = settings              // η is what this panel varies, so changing it does not make the result stale
  const key = JSON.stringify(rest)
  const run = async () => {
    setBusy(true); setError(null)
    try { setRes(await api.sensitivity({ ...rest, etas: ETAS })); setRan(key) } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return (
    <Card title="Does the answer depend on price sensitivity?" subtitle="Engine 1 re-solved at four values of η, every other setting unchanged"
      action={<Button onClick={run} busy={busy}>Run sensitivity</Button>}>
      <ErrorNote error={error} />
      {busy && !res ? <Loading>Solving four cases…</Loading> : !res ? <Empty>Run it to compare the four cases</Empty> : (
        <>
          <StaleNote show={ran !== key} />
          <div className="mb-4">
            {res.samePattern
              ? <Badge tone="emerald">Same pattern in all {res.cases.length} cases</Badge>
              : <Badge tone="rose">Pattern changes with η</Badge>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Price change by price sensitivity">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="pb-2 font-medium">Service</th>
                {res.cases.map((c) => <th key={c.eta} className="pb-2 text-right font-medium">η {c.eta}</th>)}
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {res.cases[0].prices.map((p, k) => (
                  <tr key={p.key}>
                    <td className="py-2 text-slate-800">{p.name}</td>
                    {res.cases.map((c) => (
                      <td key={c.eta} className={`py-2 text-right tabular-nums ${c.prices[k].changePct >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{pct(c.prices[k].changePct)}</td>
                    ))}
                  </tr>
                ))}
                <tr><td className="py-2 font-medium text-slate-900">Revenue</td>{res.cases.map((c) => <td key={c.eta} className="py-2 text-right font-medium tabular-nums text-slate-900">{pct(c.revenueChangePct)}</td>)}</tr>
                <tr><td className="py-2 font-medium text-slate-900">Lifetime profit</td>{res.cases.map((c) => <td key={c.eta} className="py-2 text-right font-medium tabular-nums text-slate-900">{pct(c.profitUpliftPct)}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-500">Solved in {(res.runtimeMs / 1000).toFixed(1)} s.</p>
        </>
      )}
    </Card>
  )
}

export default function Pricing({ shared }) {
  const [s, setS] = useState({ priceBound: 0.25, billShock: 0.15, ceiling: true })
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [ran, setRan] = useState(null)
  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v }))
  const req = { ...pick(shared, ['eta', 'margin', 'discount']), ...s }; const key = JSON.stringify(req)
  const run = async () => { setBusy(true); setError(null); try { setRes(await api.engine1(req)); setRan(key) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card title="Price limits" subtitle="η, margin and discount are in the shared assumptions above"
        action={<Button onClick={run} busy={busy}>Run Engine 1</Button>}>
        <div className="space-y-5">
          <Slider label="Price bound" value={s.priceBound} min={0.05} max={0.5} step={0.05} onChange={set('priceBound')} format={(v) => `±${Math.round(v * 100)}%`} />
          <Slider label="Bill-shock cap" value={s.billShock} min={0.05} max={0.3} step={0.01} onChange={set('billShock')} format={(v) => `±${Math.round(v * 100)}%`} />
          <Toggle label="Hold churn at today's level" checked={s.ceiling} onChange={set('ceiling')} />
          <ErrorNote error={error} />
        </div>
      </Card>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Revenue" value={res ? pct(res.revenueChangePct) : '—'} tone="indigo" />
          <Kpi label="Lifetime profit" value={res ? pct(res.profitUpliftPct) : '—'} hint={res ? money(res.lifetimeProfitNew) : null} tone="emerald" />
          <Kpi label="Churn vs today" value={res ? `×${res.meanHazardRatio.toFixed(3)}` : '—'} hint={res?.binding.ceilingBinding ? 'ceiling binds' : null} />
          <Kpi label="Value of 1% churn room" value={res?.shadowPricePerPctHeadroom ? money(res.shadowPricePerPctHeadroom) : '—'} tone="amber" />
        </div>
        <Card title="Optimal price list" subtitle={res ? `${res.starts.succeeded} of ${res.starts.requested} starts agree · solved in ${res.runtimeMs} ms` : 'Run the scenario to see prices'}>
          {busy && !res ? <Loading>Solving Engine 1…</Loading> : !res ? <Empty>No result yet: press Run Engine 1</Empty> : (
            <div className="overflow-x-auto">
              <StaleNote show={ran !== key} />
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="pb-2 font-medium">Service</th><th className="pb-2 text-right font-medium">Now</th><th className="pb-2 text-right font-medium">New</th>
                  <th className="pb-2 pl-4 font-medium">Change</th><th className="pb-2 font-medium">Limited by</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {res.prices.map((p) => (
                    <tr key={p.key}>
                      <td className="py-2.5 text-slate-800">{p.name}</td>
                      <td className="py-2.5 text-right tabular-nums text-slate-500">${p.current.toFixed(2)}</td>
                      <td className="py-2.5 text-right font-medium tabular-nums text-slate-900">${p.optimal.toFixed(2)}</td>
                      <td className="py-2.5 pl-4"><div className="flex items-center gap-3"><ChangeBar value={p.changePct} /><span className={`w-14 text-right text-xs font-semibold tabular-nums ${p.changePct >= 0 ? 'text-indigo-600' : 'text-rose-600'}`}>{pct(p.changePct)}</span></div></td>
                      <td className="py-2.5"><Badge tone={p.limitedBy === 'churn ceiling' ? 'amber' : p.limitedBy === 'price bound' ? 'indigo' : 'slate'}>{p.limitedBy.startsWith('bill-shock') ? 'bill-shock cap' : p.limitedBy}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <SensitivityPanel settings={req} />
      </div>
    </div>
  )
}

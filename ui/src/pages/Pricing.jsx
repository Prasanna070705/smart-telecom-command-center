import { useState } from 'react'
import { api } from '../api.js'
import { Card, Kpi, Button, Slider, Toggle, Badge, ErrorNote, Empty } from '../components/ui.jsx'
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

export default function Pricing() {
  const [s, setS] = useState({ eta: 0.8, margin: 0.7, priceBound: 0.25, billShock: 0.15, ceiling: true })
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(null)
  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v }))
  const run = async () => { setBusy(true); setError(null); try { setRes(await api.engine1(s)) } catch (e) { setError(e.message) } finally { setBusy(false) } }
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card title="Scenario" subtitle="Price sensitivity cannot be measured from this data, so it is a setting"
        action={<Button onClick={run} busy={busy}>Run Engine 1</Button>}>
        <div className="space-y-5">
          <Slider label="Price sensitivity (η)" value={s.eta} min={0.4} max={1.5} step={0.1} onChange={set('eta')} format={(v) => v.toFixed(1)} help="tested range 0.4 to 1.5" />
          <Slider label="Profit margin" value={s.margin} min={0.3} max={0.9} step={0.05} onChange={set('margin')} format={(v) => `${Math.round(v * 100)}%`} />
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
          {!res ? <Empty>No result yet</Empty> : (
            <div className="overflow-x-auto">
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
      </div>
    </div>
  )
}

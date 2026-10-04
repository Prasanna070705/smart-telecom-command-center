import { useState } from 'react'
import { api } from '../api.js'
import { useJob, JOB_STATUS } from '../useJob.js'
import { Card, Button, CancelButton, ErrorNote, Empty, Loading, StaleNote } from '../components/ui.jsx'
import { pick } from '../settings.js'
import { money, pct } from '../format.js'

function GainChart({ rows }) {           // net gain against retention budget, plain SVG
  const W = 560, H = 220, L = 64, R = 32, T = 16, B = 36   // R leaves room for the last x label
  const xs = rows.map((r) => r.budget), ys = rows.map((r) => r.netGain)
  const xMax = Math.max(...xs, 1), yMax = Math.max(...ys, 1) * 1.1
  const x = (v) => L + (v / xMax) * (W - L - R), y = (v) => H - B - (v / yMax) * (H - T - B)
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.budget)},${y(r.netGain)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Net lifetime-profit gain by retention budget">
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={L} x2={W - R} y1={y(f * yMax)} y2={y(f * yMax)} className="stroke-slate-100 dark:stroke-slate-800" />
          <text x={L - 8} y={y(f * yMax) + 4} textAnchor="end" className="fill-slate-500 dark:fill-slate-400 text-[10px]">{money(f * yMax)}</text></g>
      ))}
      <path d={line} fill="none" className="stroke-amber-500" strokeWidth="2.5" />
      {rows.map((r) => (
        <g key={r.budget}><circle cx={x(r.budget)} cy={y(r.netGain)} r="4" className="fill-amber-500" />
          <text x={x(r.budget)} y={H - B + 18} textAnchor="middle" className="fill-slate-500 dark:fill-slate-400 text-[10px]">{money(r.budget)}</text></g>
      ))}
    </svg>
  )
}

export default function Coupling({ shared }) {
  const [budgets, setBudgets] = useState('0, 15000, 30000, 60000, 90000')
  const { job, error, start: startJob, cancel, running } = useJob(); const [inputError, setInputError] = useState(null); const [ran, setRan] = useState(null)
  const req = pick(shared, ['eta', 'margin', 'discount']); const key = JSON.stringify(req)
  const start = () => {
    const list = budgets.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v >= 0)
    setInputError(list.length ? null : 'Enter at least one budget')
    if (list.length) { setRan(key); startJob(() => api.startCoupling({ ...req, budgets: list }), list.length) }
  }
  const rows = job?.progress.rows || []
  return (
    <div className="space-y-6">
      <Card title="Retention budget sweep" subtitle="Runs Engine 2 at each budget, then Engine 1 on the lower churn"
        action={<div className="flex gap-2">{running && <CancelButton onClick={cancel} />}<Button onClick={start} busy={running} tone="amber">Run sweep</Button></div>}>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-300">Budgets in dollars, comma separated
          <input value={budgets} onChange={(e) => setBudgets(e.target.value)} className="mt-2 w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 ring-1 ring-slate-200 dark:ring-slate-800 focus:ring-2 focus:ring-amber-500" />
        </label>
        {job && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500 dark:text-slate-400"><span>{JOB_STATUS[job.status]}</span><span>{job.progress.done} of {job.progress.total}</span></div>
            <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${(100 * job.progress.done) / job.progress.total}%` }} /></div>
          </div>
        )}
        <div className="mt-4"><ErrorNote error={inputError || error || job?.error} /></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Net lifetime-profit gain" subtitle="After retention spend, against today's lifetime profit">
          <StaleNote show={rows.length > 0 && ran !== key} />
          {rows.length ? <GainChart rows={rows} /> : running ? <Loading>Solving the first budget…</Loading> : <Empty>Start the sweep to draw the curve</Empty>}
        </Card>
        <Card title="Sweep results">
          {!rows.length ? (running ? <Loading>Waiting for the first row…</Loading> : <Empty>No rows yet</Empty>) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400"><th className="pb-2 font-medium">Budget</th><th className="pb-2 text-right font-medium">Offer value</th><th className="pb-2 text-right font-medium">Net gain</th><th className="pb-2 text-right font-medium">Fibre</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((r) => (
                  <tr key={r.budget}><td className="py-2 tabular-nums text-slate-700 dark:text-slate-300">{money(r.budget)}</td><td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(r.offerValue)}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">{money(r.netGain)}</td><td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{pct(r.fibrePct)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { Card, Button, ErrorNote, Empty } from '../components/ui.jsx'
import { money, pct } from '../format.js'

function GainChart({ rows }) {           // net gain against retention budget, plain SVG
  const W = 560, H = 220, L = 64, R = 16, T = 16, B = 36
  const xs = rows.map((r) => r.budget), ys = rows.map((r) => r.netGain)
  const xMax = Math.max(...xs, 1), yMax = Math.max(...ys, 1) * 1.1
  const x = (v) => L + (v / xMax) * (W - L - R), y = (v) => H - B - (v / yMax) * (H - T - B)
  const line = rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.budget)},${y(r.netGain)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Net lifetime-profit gain by retention budget">
      {[0, 0.5, 1].map((f) => (
        <g key={f}><line x1={L} x2={W - R} y1={y(f * yMax)} y2={y(f * yMax)} className="stroke-slate-100" />
          <text x={L - 8} y={y(f * yMax) + 4} textAnchor="end" className="fill-slate-400 text-[10px]">{money(f * yMax)}</text></g>
      ))}
      <path d={line} fill="none" className="stroke-amber-500" strokeWidth="2.5" />
      {rows.map((r) => (
        <g key={r.budget}><circle cx={x(r.budget)} cy={y(r.netGain)} r="4" className="fill-amber-500" />
          <text x={x(r.budget)} y={H - B + 18} textAnchor="middle" className="fill-slate-500 text-[10px]">{money(r.budget)}</text></g>
      ))}
    </svg>
  )
}

export default function Coupling() {
  const [budgets, setBudgets] = useState('0, 15000, 30000, 60000, 90000')
  const [job, setJob] = useState(null); const [error, setError] = useState(null); const timer = useRef(null)
  useEffect(() => () => clearInterval(timer.current), [])
  const start = async () => {
    setError(null); clearInterval(timer.current)
    const list = budgets.split(',').map((v) => Number(v.trim())).filter((v) => Number.isFinite(v) && v >= 0)
    if (!list.length) return setError('Enter at least one budget')
    try {
      const { jobId } = await api.startCoupling({ budgets: list })
      setJob({ status: 'running', progress: { done: 0, total: list.length, rows: [] } })
      timer.current = setInterval(async () => {
        try { const j = await api.job(jobId); setJob(j); if (j.status !== 'running') clearInterval(timer.current) } catch (e) { setError(e.message); clearInterval(timer.current) }
      }, 1000)
    } catch (e) { setError(e.message) }
  }
  const rows = job?.progress.rows || []
  const running = job?.status === 'running'
  return (
    <div className="space-y-6">
      <Card title="Retention budget sweep" subtitle="Runs Engine 2 at each budget, then Engine 1 on the lower churn"
        action={<Button onClick={start} busy={running} tone="amber">Run sweep</Button>}>
        <label className="block text-xs font-medium text-slate-600">Budgets in dollars, comma separated
          <input value={budgets} onChange={(e) => setBudgets(e.target.value)} className="mt-2 w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 ring-1 ring-slate-200 focus:ring-2 focus:ring-amber-500" />
        </label>
        {job && (
          <div className="mt-4">
            <div className="mb-1 flex justify-between text-xs text-slate-500"><span>{job.status === 'done' ? 'Finished' : job.status === 'failed' ? 'Failed' : 'Running'}</span><span>{job.progress.done} of {job.progress.total}</span></div>
            <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-amber-500 transition-all" style={{ width: `${(100 * job.progress.done) / job.progress.total}%` }} /></div>
          </div>
        )}
        <div className="mt-4"><ErrorNote error={error || job?.error} /></div>
      </Card>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Net lifetime-profit gain" subtitle="After retention spend, against today's lifetime profit">
          {rows.length ? <GainChart rows={rows} /> : <Empty>Start the sweep to draw the curve</Empty>}
        </Card>
        <Card title="Sweep results">
          {!rows.length ? <Empty>No rows yet</Empty> : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-500"><th className="pb-2 font-medium">Budget</th><th className="pb-2 text-right font-medium">Offer value</th><th className="pb-2 text-right font-medium">Net gain</th><th className="pb-2 text-right font-medium">Fibre</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.budget}><td className="py-2 tabular-nums text-slate-700">{money(r.budget)}</td><td className="py-2 text-right tabular-nums text-slate-600">{money(r.offerValue)}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-900">{money(r.netGain)}</td><td className="py-2 text-right tabular-nums text-slate-600">{pct(r.fibrePct)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  )
}

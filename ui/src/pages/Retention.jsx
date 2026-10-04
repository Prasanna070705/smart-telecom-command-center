import { useState } from 'react'
import { api } from '../api.js'
import { useJob, useElapsed, fmtElapsed } from '../useJob.js'
import { Card, Kpi, Button, CancelButton, Slider, NumberField, ErrorNote, Empty, Badge, Loading, StaleNote, TimeLimitNote, JobStatus } from '../components/ui.jsx'
import { pick, RETENTION_DEFAULTS } from '../settings.js'
import { money, int, pct, cents } from '../format.js'

const OFFER_LABEL = { '1yr': 'One-year contract', '2yr': 'Two-year contract', tech: 'Free tech support', sec: 'Free online security', auto: 'Autopay switch', '2yr+tech': 'Two-year + tech support' }
const PAGE = 15
const MAX_BUDGET = 1000000   // beyond this the agent hours and caps bind long before money does

function downloadCsv(rows) {
  const cols = ['customerID', 'offerName', 'contract', 'monthlyBill', 'monthlyHazardPct', 'expectedCost', 'expectedValue', 'hours']
  const csv = [cols.join(','), ...rows.map((r) => cols.map((c) => r[c]).join(','))].join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: 'call-list.csv' }); a.click(); URL.revokeObjectURL(url)
}

const ROBUST_CASES = ['Contract effects ×0.5', 'Contract effects ×0.25', 'Acceptance 15%', 'Acceptance 50%']   // the worker's order
const caseLabel = (c) => (c.kind === 'haircut' ? `Contract effects ×${c.factor}` : `Acceptance ${Math.round(c.factor * 100)}%`)

// Re-solves Engine 2 with weaker contract effects and other acceptance rates (a background job), the page's other settings unchanged.
function RobustnessPanel({ settings }) {
  const { job, error, start, cancel, running, reused, startedAt } = useJob(); const [ran, setRan] = useState(null); const key = JSON.stringify(settings)
  const elapsed = useElapsed(startedAt, running)
  const rows = job?.progress.rows || []
  const base = job?.result?.base
  return (
    <Card title="Does the call list survive weaker assumptions?" subtitle="Engine 2 re-solved with contract effects cut and other acceptance rates; both are scenario inputs, not measured"
      action={<div className="flex gap-2">{running && <CancelButton onClick={cancel} />}<Button onClick={() => { setRan(key); start(() => api.startRobustness(settings), 4) }} busy={running} tone="emerald">Run robustness</Button></div>}>
      <ErrorNote error={error || job?.error} />
      <JobStatus job={job} running={running} reused={reused} elapsed={elapsed}
        step={job && (job.progress.done === 0 ? 'the base list, then contract effects ×0.5' : ROBUST_CASES[job.progress.done])} />
      {!rows.length ? (running ? <Loading>Solving the base case…</Loading> : <Empty>Run it to compare four cases with this list</Empty>) : (
        <>
          <StaleNote show={ran !== key} />
          {(() => { const n = rows.filter((c) => c.timeLimitHit).length + (job.result?.base.timeLimitHit ? 1 : 0)
            return n > 0 && <TimeLimitNote seconds={job.result?.timeLimitS} count={n} of={rows.length + (job.result ? 1 : 0)} /> })()}
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Robustness of the call list">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <th className="pb-2 font-medium">Case</th><th className="pb-2 text-right font-medium">Value</th><th className="pb-2 text-right font-medium">vs base</th>
                <th className="pb-2 text-right font-medium">Called</th><th className="pb-2 text-right font-medium">Still called</th><th className="pb-2 text-right font-medium">Same offer</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {base && (
                  <tr><td className="py-2 font-medium text-slate-900 dark:text-slate-100">Base (these settings)</td><td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">{money(base.value)}</td>
                    <td className="py-2 text-right text-slate-400 dark:text-slate-500">—</td><td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{int(base.called)}</td>
                    <td className="py-2 text-right text-slate-400 dark:text-slate-500">—</td><td className="py-2 text-right text-slate-400 dark:text-slate-500">—</td></tr>
                )}
                {rows.map((c, i) => (
                  <tr key={c.kind + c.factor} className="fade-up" style={{ '--i': i }}>
                    <td className="py-2 text-slate-800 dark:text-slate-200">{caseLabel(c)}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">{money(c.value)}</td>
                    <td className={`py-2 text-right tabular-nums ${c.valueChangePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>{pct(c.valueChangePct)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{int(c.called)}</td>
                    <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{c.keptPct.toFixed(1)}%</td>
                    <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{c.sameOfferPct.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">Still called: share of the base list's customers called again. Same offer: share of those given the same offer.
            {job.result && ` Solved in ${(job.result.runtimeMs / 1000).toFixed(1)} s at a ${job.result.mipGapPct}% gap.`}</p>
        </>
      )}
    </Card>
  )
}

export default function Retention({ shared, meta }) {
  // Help text quotes the engine's own figures (agent time per call, acceptance prior) once /api/meta has loaded.
  const mins = meta?.offers.map((o) => Math.round(o.hours * 60)), prior = meta?.offerDefaults.acceptance
  const [s, setS] = useState(RETENTION_DEFAULTS)
  const [res, setRes] = useState(null); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [page, setPage] = useState(0); const [ran, setRan] = useState(null)
  const set = (k) => (v) => setS((o) => ({ ...o, [k]: v }))
  const req = { ...pick(shared, ['margin', 'discount']), ...s }; const key = JSON.stringify(req)
  const budgetError = !Number.isInteger(s.budget) ? 'Enter a whole number of dollars' : s.budget < 0 || s.budget > MAX_BUDGET ? `Between $0 and ${money(MAX_BUDGET)}` : null
  const [busySince, setBusySince] = useState(null); const [sharing, setSharing] = useState([]); const solving = useElapsed(busySince, busy)
  const run = async () => {
    setBusy(true); setBusySince(Date.now()); setError(null)
    // Background runs share the server's CPU; say so up front, since they can make this several times slower.
    api.health().then((h) => setSharing(h.jobsRunning || [])).catch(() => setSharing([]))
    try { setRes(await api.engine2(req)); setRan(key); setPage(0) } catch (e) { setError(e.message) } finally { setBusy(false); setSharing([]) }
  }
  const rows = res ? res.callList.slice(page * PAGE, page * PAGE + PAGE) : []
  const pages = res ? Math.ceil(res.callList.length / PAGE) : 0
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Card title="Campaign settings" subtitle="Who to call is chosen within these limits; press Run to build the call list"
        action={<Button onClick={run} busy={busy} disabled={!!budgetError} tone="emerald">Run Engine 2</Button>}>
        <div className="space-y-5">
          <NumberField label="Retention budget" value={s.budget} onChange={set('budget')} min={0} max={MAX_BUDGET} prefix="$" term="budget" error={budgetError}
            help={`Expected spend on offers (what accepted offers cost on average). Suggested: ${money(RETENTION_DEFAULTS.budget)}`} />
          <Slider label="Agent hours" value={s.hours} min={100} max={1500} step={50} onChange={set('hours')} format={(v) => `${int(v)} h`} term="agent-hours" help={mins ? `Total call-centre time; each call takes ${Math.min(...mins)}-${Math.max(...mins)} minutes` : 'Total call-centre time for the campaign'} />
          <Slider label="Cap per offer" value={s.cap} min={50} max={1000} step={25} onChange={set('cap')} format={int} term="cap" help="Most customers who can get the same offer" />
          <Slider label="Acceptance rate" value={s.acceptance} min={0.05} max={0.6} step={0.05} onChange={set('acceptance')} format={(v) => `${Math.round(v * 100)}%`} term="acceptance" help={prior != null ? `Share of called customers who say yes; published studies average ${Math.round(prior * 100)}%` : 'Share of called customers who say yes'} />
          <Slider label="Risk threshold" value={s.threshold} min={0.01} max={0.06} step={0.005} onChange={set('threshold')} format={(v) => `${(v * 100).toFixed(1)}% / month`} term="candidate" help="Customers this likely to leave in a month are candidates" />
          <Slider label="Contract-effect haircut" value={s.haircut} min={0.25} max={1} step={0.25} onChange={set('haircut')} format={(v) => `×${v}`} term="haircut" help="How much of the contract effect to believe: ×1 all of it, ×0.5 half" />
          {busy && (
            <div role="status" className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
              <p><span className="font-medium text-slate-800 dark:text-slate-200">Solving Engine 2</span> · {fmtElapsed(solving)}</p>
              {sharing.length > 0 && <p>A background run ({[...new Set(sharing)].map((o) => (o === 'coupling' ? 'coupling sweep' : 'robustness check')).join(', ')}) is using the server at the same time, so this takes longer than usual.</p>}
              {solving >= 20 && <p>Still solving. On a small server this can take a minute or two.</p>}
            </div>
          )}
          <ErrorNote error={error} />
        </div>
      </Card>
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label="Value preserved" term="value-preserved" value={res ? money(res.value) : '—'} hint={res ? `expected · LP bound ${money(res.lpBound)}` : null} tone="emerald" />
          <Kpi label="Customers called" term="candidate" value={res ? int(res.called) : '—'} hint={res ? `of ${int(res.pool)} at-risk customers` : null} />
          <Kpi label="Optimality gap" term="gap" value={res ? `${res.gapPct.toFixed(3)}%` : '—'} hint={res ? `greedy is ${res.greedyShortfallPct.toFixed(1)}% worse` : null} tone="indigo" />
          <Kpi label="Budget · hours used" term="agent-hours" value={res ? `${Math.round(res.budgetUsedPct)}% · ${Math.round(res.hoursUsedPct)}%` : '—'}
            hint={res?.perCall ? `per customer called: ${cents(res.perCall.expectedCost)} · ${Math.round(res.perCall.hours * 60)} min` : null} tone="amber" />
        </div>
        {res && (
          <Card title="Offer mix" subtitle="Customers per offer and the value each offer preserves">
            <div className="space-y-3">
              {Object.entries(res.mix).sort((a, b) => b[1] - a[1]).map(([k, n]) => (
                <div key={k} className="grid grid-cols-[180px_1fr_120px] items-center gap-3 text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{OFFER_LABEL[k]}</span>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="bar-grow h-2 rounded-full bg-emerald-500" style={{ width: `${(100 * n) / res.called}%` }} /></div>
                  <span className="text-right tabular-nums text-slate-900 dark:text-slate-100">{int(n)} · {money(res.valueByOffer[k])}</span>
                </div>
              ))}
            </div>
          </Card>
        )}
        <RobustnessPanel settings={req} />
        <Card title="Call list" subtitle={res ? `${int(res.callList.length)} customers, highest value first · solved in ${(res.runtimeMs / 1000).toFixed(1)} s` : 'Run the campaign to build the list'}
          action={res && <button type="button" onClick={() => downloadCsv(res.callList)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-200 dark:ring-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10">Export CSV</button>}>
          {busy && !res ? <Loading>Solving Engine 2…</Loading> : !res ? <Empty>No call list yet: press Run Engine 2</Empty> : (
            <>
              <StaleNote show={ran !== key} />
              {res.timeLimitHit && <TimeLimitNote seconds={res.timeLimitS} gapPct={res.gapPct} />}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                    <th className="pb-2 font-medium">Customer</th><th className="pb-2 font-medium">Offer</th><th className="pb-2 font-medium">Contract</th>
                    <th className="pb-2 text-right font-medium">Risk / mo</th><th className="pb-2 text-right font-medium">Cost</th><th className="pb-2 text-right font-medium">Value</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {rows.map((r, i) => (
                      <tr key={r.customerID} className="fade-up" style={{ '--i': i }}>
                        <td className="py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{r.customerID}</td>
                        <td className="py-2"><Badge tone="emerald">{r.offerName}</Badge></td>
                        <td className="py-2 text-slate-600 dark:text-slate-300">{r.contract}</td>
                        <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{r.monthlyHazardPct.toFixed(1)}%</td>
                        <td className="py-2 text-right tabular-nums text-slate-600 dark:text-slate-300">{money(r.expectedCost)}</td>
                        <td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">{money(r.expectedValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                <span>Page {page + 1} of {pages}</span>
                <div className="flex gap-2">
                  <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md px-2.5 py-1 ring-1 ring-slate-200 dark:ring-slate-800 disabled:opacity-40">Previous</button>
                  <button type="button" disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="rounded-md px-2.5 py-1 ring-1 ring-slate-200 dark:ring-slate-800 disabled:opacity-40">Next</button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}

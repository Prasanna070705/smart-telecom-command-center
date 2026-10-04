import { Card, Kpi, Badge, MetaGate } from '../components/ui.jsx'
import { int } from '../format.js'

export default function Overview({ meta, status }) {
  return <MetaGate meta={meta} status={status}><OverviewBody meta={meta} /></MetaGate>
}

function OverviewBody({ meta }) {
  const contracts = Object.entries(meta.churnByContractPct)
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Customers" value={int(meta.customers)} hint={`${int(meta.churners)} left`} />
        <Kpi label="Churn rate" term="churn" value={`${meta.churnRatePct.toFixed(1)}%`} hint="share who left" tone="rose" />
        <Kpi label="Price fit (R²)" term="price-recovery" value={meta.decompositionR2.toFixed(4)} hint={`${meta.baskets} service baskets`} tone="indigo" />
        <Kpi label="Retention candidates" term="candidate" value={int(meta.hazard.pool3)} hint="monthly risk ≥ 3%" tone="emerald" />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Recovered price list" subtitle="What each service costs today, backed out of 7,043 bills">
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {meta.prices.map((p) => (
              <li key={p.key} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700 dark:text-slate-300">{p.name}</span>
                <span className="font-medium tabular-nums text-slate-900 dark:text-slate-100">${p.price.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <div className="space-y-6">
          <Card title="Churn by contract" subtitle="Share of each contract group that left">
            <div className="space-y-3">
              {contracts.map(([name, v]) => (
                <div key={name}>
                  <div className="mb-1 flex justify-between text-xs"><span className="text-slate-600 dark:text-slate-300">{name}</span><span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{v.toFixed(1)}%</span></div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="bar-grow h-2 rounded-full bg-rose-500" style={{ width: `${v}%` }} /></div>
                </div>
              ))}
            </div>
          </Card>
          <Card title="Verification" subtitle="Every number re-derived from the raw file">
            <div className="flex flex-wrap gap-2">
              <Badge tone="emerald">{meta.verification.passed} passed</Badge>
              <Badge tone="rose">{meta.verification.refuted} deck or report claims refuted</Badge>
              <Badge tone="amber">{meta.verification.updated} earlier figure updated</Badge>
              <Badge>{meta.verification.checks} checks</Badge>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}

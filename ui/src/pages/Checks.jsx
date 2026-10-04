import { Card, Badge, MetaGate } from '../components/ui.jsx'

const ASSUMPTIONS = [
  ['Churn means "left during the recorded tenure"', 'the dataset card says "last month", which contradicts the file'],
  ['One price sensitivity for every customer', 'no price ever changed in the data'],
  ['Offer effects are model what-ifs', 'no offer was ever made; contract effects are selection-prone'],
  ['Acceptance rate', 'not in the data; 30% from the EMPC literature'],
  ['Margin, discount rate, budget, hours, caps', 'manager inputs, not data'],
]

function VerificationBadges({ v }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Badge tone="emerald">{v.passed} passed</Badge>
      <Badge tone="rose">{v.refuted} refuted</Badge>
      <Badge tone="amber">{v.updated} updated</Badge>
      <Badge>{v.checks} total</Badge>
    </div>
  )
}

export default function Checks({ meta, status }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Verification status" subtitle="Rerun with: npm run verify (73 checks) and npm run verify:coupling (3 more)">
        <MetaGate meta={meta} status={status}><VerificationBadges v={meta?.verification} /></MetaGate>
      </Card>
      <Card title="Assumptions behind every number" subtitle="State these on the slides">
        <ul className="space-y-3">
          {ASSUMPTIONS.map(([a, why]) => (
            <li key={a} className="text-sm"><p className="font-medium text-slate-800">{a}</p><p className="text-xs text-slate-500">{why}</p></li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

import { Card, Slider } from './ui.jsx'
import { SHARED_DEFAULTS } from '../settings.js'

// One set of assumptions for Pricing, Retention and Coupling, so the three pages always describe the same scenario.
export function SharedSettings({ value, onChange }) {
  const set = (k) => (v) => onChange({ ...value, [k]: v })
  const changed = Object.keys(SHARED_DEFAULTS).some((k) => value[k] !== SHARED_DEFAULTS[k])
  return (
    <Card title="Shared assumptions" subtitle="Used by Pricing, Retention and Coupling; η affects Pricing and Coupling only"
      action={changed && <button type="button" onClick={() => onChange(SHARED_DEFAULTS)} className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">Reset to defaults</button>}>
      <div className="grid gap-5 sm:grid-cols-3">
        <Slider label="Price sensitivity (η)" value={value.eta} min={0.4} max={1.5} step={0.1} onChange={set('eta')} format={(v) => v.toFixed(1)} help="a scenario input: not measurable from this data" />
        <Slider label="Profit margin" value={value.margin} min={0.3} max={0.9} step={0.05} onChange={set('margin')} format={(v) => `${Math.round(v * 100)}%`} />
        <Slider label="Discount rate" value={value.discount} min={0.005} max={0.02} step={0.0025} onChange={set('discount')} format={(v) => `${(v * 100).toFixed(2)}% / month`} />
      </div>
    </Card>
  )
}

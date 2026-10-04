// Collects every number the results chapter quotes from the running API (default settings) into
// docs/report/results-data.json, so the report can be checked against the app. Run: npm run report:data (API running).
import { writeFile } from 'node:fs/promises';
const B = process.env.API_URL || 'http://localhost:8787';
const j = async (p, body) => { const r = await fetch(B + p, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); if (!r.ok && r.status !== 202) throw new Error(`${p} ${r.status}`); return r.json(); };
const job = async (p, body) => { const { jobId } = await j(p, body); for (;;) { const s = await j(`/api/jobs/${jobId}`); if (s.status !== 'running') return s.result; await new Promise((r) => setTimeout(r, 500)); } };

const meta = await j('/api/meta');
const engine1 = await j('/api/engine1', { eta: 0.8, margin: 0.7 });
const engine1NoCeiling = await j('/api/engine1', { eta: 0.8, margin: 0.7, ceiling: false });
const sensitivity = await j('/api/engine1/sensitivity', { margin: 0.7 });
const engine2 = await j('/api/engine2', {});
const robustness = await job('/api/engine2/robustness', {});
const coupling = await job('/api/jobs/coupling', {});
const out = {
  generatedAt: new Date().toISOString(), settings: 'API defaults: eta 0.8, margin 70%, discount 1%/month; Engine 2 $30,000, 500 h, cap 350, acceptance 30%, solver gap 0.1%',
  meta, engine1, engine1NoCeiling: engine1NoCeiling.prices.map(({ key, changePct }) => ({ key, changePct })),
  sensitivity: sensitivity.cases.map(({ eta, pattern, revenueChangePct, profitUpliftPct, prices }) => ({ eta, pattern, revenueChangePct, profitUpliftPct, fibrePct: prices.find((p) => p.key === 'Fiber').changePct })),
  engine2: { ...engine2, callList: undefined, cached: undefined }, robustness, coupling,
};
await writeFile(new URL('../docs/report/results-data.json', import.meta.url), JSON.stringify(out, null, 1) + '\n');
console.log('wrote docs/report/results-data.json');

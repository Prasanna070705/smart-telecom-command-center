// Times every engine call against the plan's speed budgets (gate G4), uncached: each request carries a unique
// `nonce` the worker ignores, so the API cache never answers. Run: npm run timing (API running).
const B = process.env.API_URL || 'http://localhost:8787';
const RUNS = Number(process.env.RUNS || 3);
const post = async (p, body) => { const r = await fetch(B + p, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, nonce: Math.random() }) }); const j = await r.json(); if (!r.ok && r.status !== 202) throw new Error(`${p}: ${j.error}`); return j; };
const job = async (p, body) => { const { jobId } = await post(p, body); for (;;) { const s = await (await fetch(`${B}/api/jobs/${jobId}`)).json(); if (s.status !== 'running') { if (s.status !== 'done') throw new Error(`${p}: ${s.status} ${s.error || ''}`); return s; } await new Promise((r) => setTimeout(r, 100)); } };
const CALLS = [
  ['Engine 1 (eta 0.8)', 2, () => post('/api/engine1', { eta: 0.8 })],
  ['Engine 1 (eta 1.5)', 2, () => post('/api/engine1', { eta: 1.5 })],
  ['Engine 1 sensitivity (4 solves)', null, () => post('/api/engine1/sensitivity', {})],
  ['Engine 2 (defaults)', 10, () => post('/api/engine2', {})],
  ['Engine 2 robustness (5 solves, job)', null, () => job('/api/engine2/robustness', {})],
  ['Coupling sweep, 5 budgets (job)', 60, () => job('/api/jobs/coupling', {})],
];
let ok = true;
console.log('call'.padEnd(38), 'budget'.padStart(7), 'median'.padStart(8), 'max'.padStart(8), ` (${RUNS} uncached runs each)`);
for (const [name, budget, fn] of CALLS) {
  const t = [];
  for (let i = 0; i < RUNS; i++) { const s = performance.now(); await fn(); t.push((performance.now() - s) / 1000); }
  t.sort((a, b) => a - b); const med = t[Math.floor(t.length / 2)], max = t[t.length - 1];
  const pass = budget == null || max < budget; ok &&= pass;
  console.log(name.padEnd(38), (budget == null ? '-' : `< ${budget} s`).padStart(7), `${med.toFixed(2)} s`.padStart(8), `${max.toFixed(2)} s`.padStart(8), budget == null ? '' : pass ? ' PASS' : ' FAIL');
}
console.log(ok ? 'all calls within budget' : 'SOME CALLS OVER BUDGET');
process.exit(ok ? 0 : 1);

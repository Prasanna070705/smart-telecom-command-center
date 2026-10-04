// End-to-end API test: Node -> Python -> Node. Uses Node 22's built-in fetch.
const B = process.env.API_URL || 'http://localhost:8787';   // API_URL=... to test another server
const t = async (label, fn) => { const s = performance.now(); const r = await fn(); console.log(label.padEnd(44), `${(performance.now() - s).toFixed(0)} ms`); return r; };
const j = async (method, p, body) => { const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const txt = await r.text(); return { status: r.status, bytes: txt.length, body: JSON.parse(txt) }; };
const boot = performance.now();
const waitUntil = Date.now() + Number(process.env.WAIT_MS || 60000);
for (;;) { try { const h = await (await fetch(B + '/api/health')).json(); if (h.ok) break; } catch {}
  if (Date.now() > waitUntil) { console.error(`API not reachable on ${B}. Start it first with: npm run api`); process.exit(1); }
  await new Promise((r) => setTimeout(r, 300)); }
console.log('server + 2 Python workers ready after'.padEnd(44), `${(performance.now() - boot).toFixed(0)} ms`);
const meta = await t('GET /api/meta', () => j('GET', '/api/meta'));
const o = Object.fromEntries(meta.body.offers.map((x) => [x.key, x]));
console.log('  offers', meta.body.offers.length, '| 2yr', o['2yr'].hours, 'h', o['2yr'].expectedCost, '| 1yr', o['1yr'].hours, 'h', o['1yr'].expectedCost, '| coupling $/h', meta.body.coupling.dollarsPerHour);
console.log('  customers', meta.body.customers, 'churn %', meta.body.churnRatePct, 'pool3', meta.body.hazard.pool3, 'bytes', meta.bytes);
const e1 = await t('POST /api/engine1 (eta 0.8, margin 0.7)', () => j('POST', '/api/engine1', { eta: 0.8, margin: 0.7 }));
const fib = e1.body.prices.find((p) => p.key === 'Fiber');
console.log('  fibre', fib.changePct, fib.limitedBy, '| revenue', e1.body.revenueChangePct, '| shadow', e1.body.shadowPricePerPctHeadroom, '| bytes', e1.bytes);
const e1c = await t('POST /api/engine1 again (cache)', () => j('POST', '/api/engine1', { margin: 0.7, eta: 0.8 }));
console.log('  cached:', e1c.body.cached === true);
const sens = await t('POST /api/engine1/sensitivity (eta 0.4-1.5)', () => j('POST', '/api/engine1/sensitivity', { margin: 0.7 }));
console.log('  same pattern:', sens.body.samePattern, sens.body.patterns.join(','), '| fibre', sens.body.cases.map((c) => c.prices.find((p) => p.key === 'Fiber').changePct).join(' / '));
const sensBad = await j('POST', '/api/engine1/sensitivity', { etas: [99] });
console.log('  invalid etas status', sensBad.status, sensBad.body.error);
const e2 = await t('POST /api/engine2 (defaults)', () => j('POST', '/api/engine2', {}));
console.log('  per customer called: $', e2.body.perCall.expectedCost, '|', e2.body.perCall.hours, 'h');
console.log('  time limit hit:', e2.body.timeLimitHit, '| limit', e2.body.timeLimitS, 's');
const e2t = await t('POST /api/engine2 (1 s limit, gap 0.0001%)', () => j('POST', '/api/engine2', { mipGap: 0.000001, timeLimit: 1 }));
console.log('  forced time limit hit:', e2t.body.timeLimitHit === true && e2t.body.solverStatus === 1, '| called', e2t.body.called, '| gap %', e2t.body.gapPct);
console.log('  value', e2.body.value, 'called', e2.body.called, 'gap %', e2.body.gapPct, 'greedy %', e2.body.greedyShortfallPct, 'mix', JSON.stringify(e2.body.mix), 'bytes', e2.bytes);
const bad = await t('POST /api/engine1 (eta 99, invalid)', () => j('POST', '/api/engine1', { eta: 99 }));
console.log('  status', bad.status, bad.body.error);
const badjson = await fetch(B + '/api/engine2', { method: 'POST', body: '{oops' }); console.log('  malformed body status', badjson.status);
const job = await t('POST /api/jobs/coupling (0, 15k, 30k)', () => j('POST', '/api/jobs/coupling', { budgets: [0, 15000, 30000] }));
console.log('  status', job.status, 'jobId', job.body.jobId.slice(0, 8));
const during = await t('POST /api/engine1 (eta 1.2) during the job', () => j('POST', '/api/engine1', { eta: 1.2, margin: 0.7 }));
console.log('  answered while job runs:', during.status === 200, 'fibre', during.body.prices.find((p) => p.key === 'Fiber').changePct);
const js = performance.now(); let st;
for (;;) { st = (await j('GET', `/api/jobs/${job.body.jobId}`)).body; if (st.status !== 'running') break; await new Promise((r) => setTimeout(r, 500)); }
console.log('coupling job finished'.padEnd(44), `${(performance.now() - js).toFixed(0)} ms`, st.status);
for (const r of st.result.rows) console.log('  ', JSON.stringify(r));
const cj = await j('POST', '/api/jobs/coupling', {});
const cx = await t('DELETE /api/jobs/:id (running sweep)', () => j('DELETE', `/api/jobs/${cj.body.jobId}`));
const cx2 = await j('DELETE', `/api/jobs/${cj.body.jobId}`);
console.log('  status', cx.status, cx.body.status, '| again', cx2.status, cx2.body.error, '| GET', (await j('GET', `/api/jobs/${cj.body.jobId}`)).body.status);
const rw = performance.now(); for (;;) { const h = (await j('GET', '/api/health')).body; if (h.ok) break; await new Promise((r) => setTimeout(r, 200)); }
console.log('jobs worker back after cancel'.padEnd(44), `${(performance.now() - rw).toFixed(0)} ms`);
const rb = await t('POST /api/engine2/robustness (gap 0.01%)', () => j('POST', '/api/engine2/robustness', { mipGap: 0.0001 }));
console.log('  status', rb.status, 'jobId', rb.body.jobId.slice(0, 8));
const rs = performance.now(); let rj;
for (;;) { rj = (await j('GET', `/api/jobs/${rb.body.jobId}`)).body; if (rj.status !== 'running') break; await new Promise((r) => setTimeout(r, 500)); }
console.log('robustness job finished'.padEnd(44), `${(performance.now() - rs).toFixed(0)} ms`, rj.status);
const REF = { 'haircut 0.5': [152666, 88, 45], 'haircut 0.25': [126886, 81, 47], 'acceptance 0.15': [104046, 80], 'acceptance 0.5': [248344, 95] };   // verify.py G9/G10
let rok = rj.status === 'done';
for (const c of rj.result?.cases || []) {
  const [v, kept, same] = REF[`${c.kind} ${c.factor}`]; const ok = Math.abs(c.value / v - 1) < 0.001 && Math.abs(c.keptPct - kept) <= 2 && (same == null || Math.abs(c.sameOfferPct - same) <= 2);
  rok &&= ok; console.log('  ', c.kind, c.factor, '| value', c.value, '| kept %', c.keptPct, '| same offer %', c.sameOfferPct, ok ? '' : `MISMATCH (ref ${v}, ${kept}, ${same ?? '-'})`);
}
console.log('  matches G9/G10:', rok, '| base', rj.result?.base.value);
const rbBad = await j('POST', '/api/engine2/robustness', { haircuts: [2] });
console.log('  invalid haircut status', rbBad.status, rbBad.body.error);
const { existsSync } = await import('node:fs'); const saved = (id) => existsSync(new URL(`../results/jobs/${id}.json`, import.meta.url));
console.log('finished jobs saved to disk:', [job.body.jobId, cj.body.jobId, rb.body.jobId].every(saved), '(coupling, cancelled, robustness)');
console.log('unknown endpoint status', (await j('GET', '/api/nope')).status, '| missing job status', (await j('GET', '/api/jobs/xyz')).status);

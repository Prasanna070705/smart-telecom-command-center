// End-to-end API test: Node -> Python -> Node. Uses Node 22's built-in fetch.
const B = 'http://localhost:8787';
const t = async (label, fn) => { const s = performance.now(); const r = await fn(); console.log(label.padEnd(44), `${(performance.now() - s).toFixed(0)} ms`); return r; };
const j = async (method, p, body) => { const r = await fetch(B + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }); const txt = await r.text(); return { status: r.status, bytes: txt.length, body: JSON.parse(txt) }; };
const boot = performance.now();
const waitUntil = Date.now() + Number(process.env.WAIT_MS || 60000);
for (;;) { try { const h = await (await fetch(B + '/api/health')).json(); if (h.ok) break; } catch {}
  if (Date.now() > waitUntil) { console.error('API not reachable on http://localhost:8787. Start it first with: npm run api'); process.exit(1); }
  await new Promise((r) => setTimeout(r, 300)); }
console.log('server + 2 Python workers ready after'.padEnd(44), `${(performance.now() - boot).toFixed(0)} ms`);
const meta = await t('GET /api/meta', () => j('GET', '/api/meta'));
console.log('  customers', meta.body.customers, 'churn %', meta.body.churnRatePct, 'pool3', meta.body.hazard.pool3, 'bytes', meta.bytes);
const e1 = await t('POST /api/engine1 (eta 0.8, margin 0.7)', () => j('POST', '/api/engine1', { eta: 0.8, margin: 0.7 }));
const fib = e1.body.prices.find((p) => p.key === 'Fiber');
console.log('  fibre', fib.changePct, fib.limitedBy, '| revenue', e1.body.revenueChangePct, '| shadow', e1.body.shadowPricePerPctHeadroom, '| bytes', e1.bytes);
const e1c = await t('POST /api/engine1 again (cache)', () => j('POST', '/api/engine1', { margin: 0.7, eta: 0.8 }));
console.log('  cached:', e1c.body.cached === true);
const e2 = await t('POST /api/engine2 (defaults)', () => j('POST', '/api/engine2', {}));
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
console.log('unknown endpoint status', (await j('GET', '/api/nope')).status, '| missing job status', (await j('GET', '/api/jobs/xyz')).status);

// Zero-dependency Node.js API (node:http). Owns: HTTP routing, validation of transport, caching, background jobs,
// static hosting of the built UI. Python owns all modelling. Run: node server/server.mjs   (PORT env, default 8787)
import http from 'node:http';
import { spawn } from 'node:child_process';
import { readFile, stat, writeFile, mkdir, readdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ENGINE_DIR = path.join(ROOT, 'engine');
const DIST = path.join(ROOT, 'ui', 'dist');
const JOB_DIR = path.join(ROOT, 'results', 'jobs');   // finished jobs, reloaded at start (gitignored)
const PORT = Number(process.env.PORT || 8787);
const PYTHON = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');

class Worker {                      // one long-lived Python process, JSON lines both ways
  constructor(name) { this.name = name; this.pending = new Map(); this.ready = false; this.start(); }
  start() {
    this.ready = false; this.buf = '';
    this.proc = spawn(PYTHON, ['worker.py'], { cwd: ENGINE_DIR, stdio: ['pipe', 'pipe', 'pipe'] });
    this.proc.stdout.setEncoding('utf8');
    this.proc.stdout.on('data', (chunk) => {
      this.buf += chunk; let i;
      while ((i = this.buf.indexOf('\n')) >= 0) { const line = this.buf.slice(0, i); this.buf = this.buf.slice(i + 1); if (line.trim()) this.onLine(line); }
    });
    this.proc.stderr.on('data', () => {});            // solver chatter; attach a logger here if needed
    this.proc.stdin.on('error', () => {});             // a write racing a restart must not crash the API
    this.proc.on('exit', (code) => {
      const why = this.killReason || `${this.name} worker exited (${code})`; this.killReason = null; this.ready = false;
      for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(new Error(why)); }
      this.pending.clear(); setTimeout(() => this.start(), 1000);   // auto-restart
    });
  }
  onLine(line) {
    let msg; try { msg = JSON.parse(line); } catch { return; }
    if (msg.id === 'ready') { this.ready = true; this.startup = msg.result; return; }
    const p = this.pending.get(msg.id); if (!p) return;
    if (msg.progress) { p.onProgress?.(msg.progress); return; }
    this.pending.delete(msg.id); clearTimeout(p.timer);
    msg.ok ? p.resolve(msg.result) : p.reject(Object.assign(new Error(msg.error), { status: 400 }));
  }
  restart(reason) { this.killReason = reason; this.ready = false; this.proc.kill(); }   // the exit handler restarts it
  call(op, params = {}, { timeoutMs = 120000, onProgress } = {}) {
    return new Promise((resolve, reject) => {
      const id = randomUUID();
      const timer = setTimeout(() => { this.pending.delete(id); reject(Object.assign(new Error(`${op} timed out`), { status: 504 })); }, timeoutMs);
      this.pending.set(id, { resolve, reject, onProgress, timer });
      this.proc.stdin.write(JSON.stringify({ id, op, params }) + '\n');
    });
  }
}
const fast = new Worker('fast');      // meta, engine1, sensitivity, engine2
const slow = new Worker('jobs');      // coupling sweeps and robustness runs, so they never block interactive calls

const cache = new Map();              // identical requests return instantly
async function cached(op, params) {
  const key = op + JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]));
  if (cache.has(key)) return { ...cache.get(key), cached: true };
  const res = await fast.call(op, params);
  cache.set(key, res); if (cache.size > 100) cache.delete(cache.keys().next().value);
  return res;
}

const jobs = new Map();               // coupling sweeps and robustness runs: several solves each, run on the jobs worker
const saveJob = (job) => mkdir(JOB_DIR, { recursive: true }).then(() => writeFile(path.join(JOB_DIR, `${job.id}.json`), JSON.stringify(job))).catch((e) => console.error('could not save job', job.id, e.message));
async function loadJobs() {
  let files = []; try { files = (await readdir(JOB_DIR)).filter((f) => f.endsWith('.json')); } catch { return; }
  for (const f of files) { try { const j = JSON.parse(await readFile(path.join(JOB_DIR, f), 'utf8')); if (j.id && j.status !== 'running') jobs.set(j.id, j); } catch {} }
  if (jobs.size) console.log(`loaded ${jobs.size} finished jobs from ${path.relative(ROOT, JOB_DIR)}`);
}
function startJob(op, params, total) {
  if (!slow.ready) throw Object.assign(new Error('jobs worker restarting, retry shortly'), { status: 503 });
  const job = { id: randomUUID(), op, status: 'running', progress: { done: 0, total, rows: [] }, createdAt: Date.now() };
  jobs.set(job.id, job);
  slow.call(op, params, { timeoutMs: 30 * 60 * 1000, onProgress: (p) => { job.progress.done = p.done; job.progress.total = p.total; job.progress.rows.push(p.row); } })
    .then((r) => { if (job.status === 'running') { Object.assign(job, { status: 'done', result: r, finishedAt: Date.now() }); saveJob(job); } })
    .catch((e) => { if (job.status === 'running') { Object.assign(job, { status: 'failed', error: e.message, finishedAt: Date.now() }); saveJob(job); } });
  return job;
}
// A running solve cannot be interrupted from outside, so cancelling restarts the jobs worker (~1.5 s); other running jobs fail with a message.
function cancelJob(job) {
  if (job.status !== 'running') throw Object.assign(new Error(`job already ${job.status}`), { status: 409 });
  Object.assign(job, { status: 'cancelled', finishedAt: Date.now() }); saveJob(job);
  slow.restart(`jobs worker restarted to cancel job ${job.id.slice(0, 8)}`);
  return job;
}

const send = (res, code, body) => { const s = JSON.stringify(body); res.writeHead(code, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(s) }); res.end(s); };
const readJson = (req) => new Promise((resolve, reject) => {
  let n = 0; const parts = [];
  req.on('data', (c) => { n += c.length; if (n > 1e6) { reject(Object.assign(new Error('body too large'), { status: 413 })); req.destroy(); } else parts.push(c); });
  req.on('end', () => { try { resolve(parts.length ? JSON.parse(Buffer.concat(parts).toString()) : {}); } catch { reject(Object.assign(new Error('invalid JSON'), { status: 400 })); } });
});
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png' };
async function serveStatic(res, urlPath) {
  let file = path.join(DIST, decodeURIComponent(urlPath));
  if (!file.startsWith(DIST)) return send(res, 403, { error: 'forbidden' });
  try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); } catch { file = path.join(DIST, 'index.html'); }
  try { const data = await readFile(file); res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }); res.end(data); }
  catch { send(res, 404, { error: 'UI not built: run the UI build first' }); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  try {
    if (req.method === 'GET' && url.pathname === '/api/health') return send(res, 200, { ok: fast.ready && slow.ready, workers: { fast: fast.ready, jobs: slow.ready } });
    if (url.pathname.startsWith('/api/') && !fast.ready) return send(res, 503, { error: 'engine starting, retry shortly' });
    if (req.method === 'GET' && url.pathname === '/api/meta') return send(res, 200, await cached('meta', {}));
    if (req.method === 'POST' && url.pathname === '/api/engine1') return send(res, 200, await cached('engine1', await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/engine1/sensitivity') return send(res, 200, await cached('sensitivity', await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/engine2') return send(res, 200, await cached('engine2', await readJson(req)));
    if (req.method === 'POST' && url.pathname === '/api/engine2/robustness') {
      const p = await readJson(req); const { cases } = await fast.call('robustness_check', p);   // bad input -> 400 before any job starts
      return send(res, 202, { jobId: startJob('robustness', p, cases).id });
    }
    if (req.method === 'POST' && url.pathname === '/api/jobs/coupling') { const p = await readJson(req); return send(res, 202, { jobId: startJob('coupling', p, (p.budgets || [0, 15000, 30000, 60000, 90000]).length).id }); }
    if ((req.method === 'GET' || req.method === 'DELETE') && url.pathname.startsWith('/api/jobs/')) {
      const j = jobs.get(url.pathname.split('/').pop()); if (!j) return send(res, 404, { error: 'no such job' });
      return send(res, 200, req.method === 'DELETE' ? cancelJob(j) : j);
    }
    if (url.pathname.startsWith('/api/')) return send(res, 404, { error: 'unknown endpoint' });
    if (req.method === 'GET') return serveStatic(res, url.pathname);
    send(res, 405, { error: 'method not allowed' });
  } catch (e) { send(res, e.status || 500, { error: e.message }); }
});
await loadJobs();
server.listen(PORT, () => console.log(`API on http://localhost:${PORT}`));

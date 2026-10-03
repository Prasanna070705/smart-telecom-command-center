// Day 1 prerequisite check. Run from the repo root: node tests/day1-check.mjs
// Checks Node.js (Vite 8 needs 20.19+ or 22.12+), npm, git, Python, the pinned Python libraries and the dataset.
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const py = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
const rows = [];
const check = (name, fn) => { try { const [ok, detail] = fn(); rows.push([ok ? 'PASS' : 'FAIL', name, detail]); } catch (e) { rows.push(['FAIL', name, e.message.split('\n')[0]]); } };
const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }).trim();

check('Node.js 20.19+ or 22.12+', () => {
  const [maj, min] = process.versions.node.split('.').map(Number);
  return [maj > 22 || (maj === 22 && min >= 12) || (maj === 20 && min >= 19), `found ${process.versions.node}`];
});
check('npm', () => [true, `found ${run('npm', ['-v'])}`]);
check('git', () => [true, run('git', ['--version'])]);
check(`Python 3.11+ (command: ${py})`, () => {
  const v = run(py, ['-c', 'import sys; print("%d.%d.%d" % sys.version_info[:3])']);
  const [maj, min] = v.split('.').map(Number); return [maj === 3 && min >= 11, `found ${v}; tested on 3.12.3`];
});
check('pinned Python libraries', () => {
  const want = readFileSync('engine/requirements.txt', 'utf8').split('\n').filter((l) => l.includes('==')).map((l) => l.trim().split('=='));
  const got = JSON.parse(run(py, ['-c', 'import json,importlib.metadata as m\nout={}\nfor p in ' + JSON.stringify(want.map((w) => w[0])) + ':\n  try: out[p]=m.version(p)\n  except Exception: out[p]=None\nprint(json.dumps(out))']));
  const bad = want.filter(([p, v]) => got[p] !== v).map(([p, v]) => `${p} wants ${v}, has ${got[p] ?? 'none'}`);
  return [bad.length === 0, bad.length ? bad.join('; ') : want.map(([p, v]) => `${p} ${v}`).join(', ')];
});
check('dataset present (7,043 customers)', () => {
  const f = 'engine/WA_Fn-UseC_-Telco-Customer-Churn.csv';
  if (!existsSync(f)) return [false, `${f} missing`];
  const n = readFileSync(f, 'utf8').trim().split(/\r?\n/).length - 1; return [n === 7043, `${n} rows`];
});
for (const [s, n, d] of rows) console.log(`${s}  ${n.padEnd(38)} ${d}`);
const failed = rows.filter((r) => r[0] === 'FAIL').length;
console.log(failed ? `\n${failed} check(s) failed: fix them before gate G1.` : '\nAll prerequisites met.');
process.exit(failed ? 1 : 0);

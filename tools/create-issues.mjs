// Creates one GitHub issue per remaining day of the two-week plan (Days 2-10), assigned to you.
// Needs the GitHub CLI, logged in (gh auth login), run from inside the repository folder.
// Usage: node tools/create-issues.mjs            (add --dry-run to print the commands without creating anything)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const DAYS = [
  [2, 'speed and shell', ['Profile `/api/engine2` (integer program is 3.6 s of 7.4 s); cut the rest. Done when the value is unchanged and the call is under 5 s.', 'Add `DELETE /api/jobs/:id` and allow one sweep at a time.', 'Polish the UI shell: sidebar, header, cards, loading and empty states at 1280 and 1440 px.', 'Turn the API contract table into automated tests.']],
  [3, 'API frozen (gate G2)', ['Add the Engine 1 sensitivity call for eta 0.4, 0.8, 1.2, 1.5 (reproduces check F2).', 'Freeze contract v1 in `docs/api.md`; log each request with its time.', 'Finish the Pricing page, including the sensitivity panel.', 'Gate G2: all contract tests pass.']],
  [4, 'retention depth', ['Add the Engine 2 robustness call (reproduces checks G9 and G10).', 'Save finished job results to disk as JSON.', 'Finish the Retention page: call list, CSV, offer mix, robustness panel.', 'Extend the browser test to the new panels.']],
  [5, 'coupling page', ['Switch verify.py stage H to the 0.1% gap; table matches within 0.1%.', 'Show worker restarts and last error in `/api/health`.', 'Finish the Coupling page: progress, chart, table, cancel button.', 'Mid-point review: log every UI issue.']],
  [6, 'every page end to end (gate G3)', ['Freeze engine logic; document every public function.', 'Production mode: `npm run build:ui` then `npm run api` serves the app on 8787.', 'Finish Overview and Data & checks; error states on every page.', 'Gate G3: browser test passes against the production build.']],
  [7, 'polish', ['Chart data for the sensitivity panel and coupling curve.', 'Test input limits, body size limits and per-call timeouts.', 'Visual polish: type scale, spacing, number formats, focus, contrast.', 'Write the methodology chapter of the report.']],
  [8, 'robust and fast (gate G4)', ['Time each call: Engine 1 under 2 s, Engine 2 under 10 s, sweep under 60 s.', 'Check Chrome, Firefox and Edge (Safari if available).', 'Fix what the browser check finds; check layout at 1024 px.', 'Apply the nine slide fixes; gate G4.']],
  [9, 'feature freeze', ['Install from a fresh clone on a machine that has never run the project.', 'Default settings load the headline results for the demo.', 'Write the demo script; rehearsal 1.']],
  [10, 'demo-ready (gate G5)', ['Final `npm run verify` and `npm run verify:coupling`; archive logs.', 'Tag v1.0 and finish the README.', 'Take slide screenshots from the real app.', 'Rehearsal 2 and submit.']],
];

const dry = process.argv.includes('--dry-run');
const gh = (args) => (dry ? (console.log('gh ' + args.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(' ')), '') : execFileSync('gh', args, { encoding: 'utf8' }).trim());
if (!dry) {
  try { execFileSync('gh', ['auth', 'status'], { stdio: 'ignore' }); }
  catch { console.error('GitHub CLI is not installed or not logged in. Run: gh auth login'); process.exit(1); }
}
const dir = mkdtempSync(path.join(tmpdir(), 'issues-'));
try {
  for (const [day, goal, tasks] of DAYS) {
    const file = path.join(dir, `day-${day}.md`);
    writeFileSync(file, `From the two-week build plan. Tick each task only when its test passes.\n\n${tasks.map((t) => `- [ ] ${t}`).join('\n')}\n`);
    const url = gh(['issue', 'create', '--title', `Day ${day}: ${goal}`, '--body-file', file, '--assignee', '@me']);
    if (!dry) console.log(`Day ${day}: ${url}`);
  }
} finally { rmSync(dir, { recursive: true, force: true }); }

# Smart Telecom Revenue & Churn Command Center

Operations Research project, now done by one person. Two optimisation engines on the IBM Telco churn data
(7,043 customers, 21 columns): Engine 1 sets the prices of 10 services (nonlinear program); Engine 2 picks which
at-risk customers to call with which of 6 retention offers (binary integer program). A coupling sweep shows how
retention spend frees room to raise prices. Read `docs/context/` before starting a plan day:
- `docs/context/plan.md` - Days 3-10 tasks (Must/Could), gates, acceptance numbers
- `docs/context/decisions.md` - modelling decisions, assumptions, what must never be claimed, known gaps
- `docs/context/history.md` - what Days 1-2 did, results on this Mac, problems hit and their fixes

## Layout
- `engine/` Python, all modelling. `common.py` load + price recovery, `hazard.py` monthly hazard model,
  `engine1.py` SLSQP price optimizer, `engine2.py` offer assignment (SciPy HiGHS), `worker.py` JSON-lines worker,
  `verify.py` 76 model checks (73 in stages A-G, I, J via `npm run verify`; 3 in stage H via `npm run verify:coupling`).
- `server/server.mjs` Node.js API, no npm dependencies. Spawns two Python workers (interactive + background jobs: coupling, robustness).
- `ui/` React + Tailwind 4, built with Vite 8 (scaffolded from the official react template; our files are in `ui/src`).
- `tests/` `day1-check.mjs` (prerequisites), `api.test.mjs`, `e2e.test.mjs` (Playwright, 16 steps), `run-verify.mjs`.
- `tools/create-issues.mjs` GitHub issues per plan day. `docs/day1-baseline.md` timings per machine.

## Commands (macOS, zsh, Python env in .venv)
- `source .venv/bin/activate` first in every terminal that runs Python or the API.
- `npm run check` prerequisites; `npm run verify` runs 73 of the 76 model checks, stages A-G, I, J (expect PASS 67 | FAIL 6; the six expected FAILs are
  A5b, A7b, B2b, D6, D8, D9); `npm run verify -- G` Engine 2 checks only; `npm run verify:coupling` runs the other 3 (stage H).
- `npm run api` API on :8787 (long-running; keep in its own terminal). `npm run ui` Vite dev on :5173.
- `npm run test:api` (API must be running). `npm run build:ui` then `npm run test:e2e` (tests the built app on :8787;
  `BROWSER=chrome|webkit|firefox` for another browser).
- `npm run timing` speed budgets; `npm run report:data`, `npm run screenshots` regenerate report numbers and images.

## Rules for working here
- Run long-running servers (`npm run api`, `npm run ui`) in the background or a separate terminal; never block on them.
- Restart the API after any change to `engine/*.py` or `server/server.mjs`: it loads code only at start.
- Rebuild (`npm run build:ui`) before `npm run test:e2e` after any UI change: the browser test uses `ui/dist`.
- Port 8787 busy -> `kill $(lsof -t -iTCP:8787 -sTCP:LISTEN)`.
- zsh: inline `# comments` in pasted commands break unless `setopt interactivecomments` is set.
- Every number shown in the UI comes from the API; never hard-code results in pages.
- Tailwind: complete class names only (map tones to full strings; never build `bg-${x}-600`).
- New engine features: add the operation in `worker.py`, a route in `server.mjs` above the 404 fallback,
  a method in `ui/src/api.js`, a line in `tests/api.test.mjs`, a step in `tests/e2e.test.mjs`.
- Validate inputs in Python with `num(p, key, default, lo, hi)`; errors return HTTP 400 with the message.
- Before committing: `npm run test:api`, and after UI changes `npm run build:ui && npm run test:e2e`; after engine
  changes the relevant `npm run verify` stage. Report what passed.
- Commits: small, Conventional Commits (`feat(engine1): ...`, `feat(ui): ...`, `perf(...)`, `test: ...`, `docs: ...`).
  Show the diff and ask before `git push`.
- Never claim measured price sensitivity or measured offer effects; they are scenario inputs (see decisions.md).

## Current state
- Day 1 done: tag `g1-toolchain`. Day 2 done: sensitivity call + Pricing panel + Engine 2 speed-up + tests
  (HEAD was f63898a "test: cover the sensitivity call and panel"), pushed to origin/main.
- Mac measurements recorded (docs/day1-baseline.md, README "Where it has run"): verify (73 checks) 67/6 in 38.8 s, API ready
  1.3 s, test:e2e 12/12.
- Day 3 done: robustness background job + Retention panel; gate G2 passes through the API.
- Day 4 done: stage H on the 0.1% gap checked against acceptance; job cancel (DELETE /api/jobs/:id).
- Day 5 done (gate G3): fresh clone passes check, test:api, test:e2e (15 steps); finished jobs saved to results/jobs.
- Day 6 done: shared assumptions card (margin, discount, eta) across Pricing/Retention/Coupling; loading/error states.
- Day 7 done: report drafts in docs/report/, `npm run report:data`, `npm run screenshots`.
- Day 8 done on my side: `npm run timing` all within budget, e2e 16/16 in Chrome, docs/slide-fixes.md. G4 waits on
  the user's Safari check and deck edits.
- Day 9 done: fresh GitHub clone passes every test; docs/demo-script.md; WebKit e2e 16/16.
- Day 10 done on my side: final verify 67/6 + 3/0, tests pass, tag v1.0 local (push on approval).
- Open, the user's: Safari check, deck edits (docs/slide-fixes.md), two timed rehearsals, submission.

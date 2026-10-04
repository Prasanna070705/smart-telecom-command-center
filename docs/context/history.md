# What happened so far

## Day 1 (done, tag g1-toolchain)
- Machine: MacBook Air, macOS, Node 24.12.0, npm 11.6.2, git 2.52.0, Python 3.14.3 (all 76 model checks run on 3.12.3 and 3.14.3).
- Libraries installed in .venv with `pip install --only-binary=:all: -r engine/requirements.txt` (worked on 3.14).
- `npm run test:api` matched every reference number. The coupling $15k row gave net gain 2,320,895 vs 2,336,218 in
  the sandbox (0.66% lower; same solver tolerance, different near-optimal list) -> acceptance tolerance set to 1%.
- First-run timings: engine1 262 ms, engine2 2,813 ms, coupling job 6,016 ms, meta 6 ms.

## Day 2 (done)
- Added `sensitivity` worker op, `POST /api/engine1/sensitivity`, `api.sensitivity()`, SensitivityPanel on Pricing,
  test lines; Engine 2 greedy loop sped up (plain lists instead of pandas lookups): engine2 2.8 s -> 1.7 s on the Mac,
  verify G unchanged (sandbox PASS 10).
- Mac results: sensitivity 1,031 ms, `True ['+U--UUUUUU']`; engine2 1,691 ms; coupling 4,012 ms.
- Commits: fd9db59 feat(engine1), 147c0f6 feat(ui), b90e1e0 perf(engine2), f63898a test.

## Day 3 (robustness call + Retention panel, gate G2)
- Worker op `robustness` (+ `robustness_check`, validation only), `POST /api/engine2/robustness` -> 202 {jobId}, polled at
  `/api/jobs/:id`. It is a background job on the jobs worker: 5 solves take 5.6 s at the 0.1% gap and 28 s at 0.01% on
  the Mac, too long to block interactive calls. The route validates first on the fast worker, so bad input is still 400.
- Cases default to haircut 0.5 / 0.25 and acceptance 0.15 / 0.5 (`haircuts`, `acceptances` lists, max 4 each); every
  other setting is the request's. kept / same offer defined as in verify.py G9/G10.
- Through the API at mipGap 0.0001: $152,666 / 88.5% / 44.5%; $126,880 / 81.4% / 47.2%; $104,046 / 79.6%; $248,344 / 95.3%.
  Identical to G9/G10 on this Mac ($126,886 in the plan is the sandbox value, 0.005% away). At 0.1%: $152,614, $248,230.
- RobustnessPanel on Retention uses the page's settings. Tests: api (matches G9/G10: true, 400 on haircut 2), e2e 13/13.

## Problems hit and fixes
- `npm run check` FAIL on pinned libraries before install: expected.
- `npm run test:api` "API not reachable": API not started (it also appears when workers fail to start).
- `{"error":"UI not built..."}` at :8787 before `npm run build:ui`: expected.
- ERR_CONNECTION_REFUSED on :5173: Vite dev server not running (`npm run ui`).
- EADDRINUSE :8787: old API still running -> kill it, restart.
- zsh passed inline `# notes` as arguments (vite "Unused args", "zsh: number expected") -> setopt interactivecomments.
- Browser test failed at the sensitivity step: stale ui/dist -> rebuild before test:e2e.

## Day 1-2 measurements on this Mac (done 2026-10-04)
- `npm run verify` (73 of 76 checks, stages A-G, I, J): PASS 67 | FAIL 6 (the expected A5b, A7b, B2b, D6, D8, D9), 38.8 s wall-clock.
- API cold start: listening 0.09 s, both workers ready 1.3 s. `npm run test:api`: all reference numbers match.
- `npm run build:ui` (Vite 8.3.2) then `npm run test:e2e`: 12/12 PASS.
- Recorded in docs/day1-baseline.md and README "Where it has run".

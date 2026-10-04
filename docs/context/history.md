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

## Day 4 (coupling)
- verify.py stage H now solves Engine 2 with the API's settings (gap 0.1%, 30 s). H2 used to print only; it now checks
  the haircut-1 net gains against the acceptance table (each within 1%; $15k row a 2.32-2.34 range). Still 3 checks.
  Result: 1.294 / 2.321 / 3.151 / 3.278 / 3.304 $M, PASS 3, 11.6 s (was 74.6 s at 0.01%). Haircut 0.5: 1.776 / 2.427.
- Coupling page, full sweep in the browser: $1.29M, $2.32M, $3.15M, $3.28M, $3.30M = acceptance table.
- Could item done: `DELETE /api/jobs/:id` + Cancel button on Coupling and Robustness. Cancel restarts the jobs worker
  (a running solve cannot be interrupted); back in ~2 s; 409 if the job already stopped, 503 while restarting. Other
  running jobs fail with "jobs worker restarted to cancel job ...". Job polling moved into `ui/src/useJob.js`.
- Fixed while there: a job write racing a worker restart could crash the API (stdin EPIPE); now ignored.
- Tests: test:api (cancel 200, again 409, worker back 2.2 s, robustness still matches G9/G10), test:e2e 14/14.
- Problem: e2e `getByText('Finished')` matched the hidden Retention panel too (pages stay mounted) -> exact match.

## Day 5 (production build and browser test, gate G3)
- Production build served on :8787; all five pages work. New e2e step for Data & checks (76 total, assumptions list):
  the browser test now visits every page and covers the sensitivity, robustness and cancel panels. 15 steps.
- Fresh clone (git clone of the local repo into a scratch folder, new .venv, `npm ci` root + ui, pip --only-binary):
  `npm run check` all met, build, test:api (all reference numbers, G9/G10 true), test:e2e 15/15. Done twice: at
  e6c11f6 and again at 804c6bc after the server change below. Install 14 s.
- First API start in a fresh .venv: 42.5 s and 30.6 s to both workers ready (Python compiling the new libraries on
  first import); ~1.3-1.5 s afterwards. README now says so.
- README "Run it" rewritten from the fresh-clone steps (ui is committed, so `npm --prefix ui ci`, no Vite scaffold),
  plus the zsh `setopt interactivecomments` note.
- Could item done: finished / failed / cancelled jobs saved to `results/jobs/<id>.json` (gitignored), reloaded at
  start. Checked by restarting the API: "loaded 3 finished jobs", GET returns the saved result. test:api checks the files.
- Noticed, not changed (Day 6): `op_meta` hard-codes the verification counts (76 / 70 / 5 / 1); they agree with
  verify (67 + 3 PASS, 6 expected FAIL) but are not computed. The Checks card says "python verify.py", not `npm run verify`.

## Day 6 (polish + shared settings, option 1 chosen by the user)
- Shared assumptions card (margin, discount, eta) on Pricing, Retention, Coupling; one state in App. Each page sends
  only what its engine uses (Engine 2: margin, discount). Coupling now follows the shared eta (closes that known gap).
  Defaults 0.8 / 70% / 1% unchanged, so every acceptance number is unchanged. Offer terms still hard-coded (option 2 not chosen).
- A result run with other settings shows "Settings changed since this run" (StaleNote). The sensitivity panel ignores
  eta for this, since it varies eta itself.
- Loading / empty / error states on every page: spinner in each result area while solving; Overview and Data & checks
  show loading, then "API not reachable" after ~12 s (dev mode only; in production the API serves the page). Header
  status: Connecting / Engines starting / API not reachable / Engines ready. Checked by hand on :5173 with the API
  stopped, then started: recovers by itself.
- Could: contrast (empty text, slider help, chart labels slate-400 -> slate-500), nav focus ring. Type scale and
  spacing left as they are.
- Data & checks subtitle now names `npm run verify` / `verify:coupling`. Verification counts are still hard-coded in
  op_meta (they agree with verify).
- Tests: test:e2e 16/16 (new step: margin change marks the call list stale, Reset to defaults clears it). The Pricing
  step leaves eta at 1.5; the reset step returns it to 0.8 before the Coupling step, which checks the acceptance numbers.
- Commit note: the shared-settings and loading-state changes share 43 hunks, so they went in as one feat(ui) commit.

## Day 7 (report drafts)
- `docs/report/methodology.md`: data, price recovery, hazard model, Engine 1 NLP, Engine 2 BIP, coupling, the 6
  refuted/updated claims, assumptions table, never-claim list, known limits.
- `docs/report/results.md`: every page's results with screenshots and a "reading the result" paragraph each.
  Numbers from `docs/report/results-data.json` (`npm run report:data`); all match the acceptance table.
- `npm run screenshots` (tools/screenshots.mjs): full-page 2x shots of all five pages with results, into
  docs/screenshots/ (2.0 MB). Reused for the demo on Day 9.
- Screenshots exposed three UI bugs, fixed: the sensitivity header read "H 0.4" (CSS uppercase turns η into H),
  the last Coupling x label was clipped, "Run Engine 1/2" wrapped onto 3 lines. e2e 16/16 after.
- Corrected in my own draft before committing: an unverified reason for the fibre cut, and "flat after $30k" (net gain
  still +$0.13M for $30k -> $60k).

## Day 8 (gate G4)
- `npm run timing` (tools/timing.mjs): 3 uncached runs per call (unique `nonce` defeats the API cache). On the Mac:
  Engine 1 0.25 s (eta 0.8) / 0.26 s (eta 1.5), budget 2 s; sensitivity 1.03 s; Engine 2 1.59 s, budget 10 s;
  robustness 5.43 s; coupling sweep 5 budgets 5.23 s, budget 60 s. All PASS. (Sandbox, 1 CPU, was ~4.6x slower on
  Engine 2: 7.4 s, still inside 10 s.)
- Browsers: e2e takes BROWSER=chromium|chrome|webkit|firefox. Google Chrome 154: 16/16; Playwright Chromium 153: 16/16.
  Second browser = Safari, checked by the user (not by me). Playwright WebKit is not installed here.
- `docs/slide-fixes.md`: the nine fixes with replacement wording and the verify check behind each number, plus the
  report numbers to look out for (B2b, D8, D9). The deck is not on this machine (the four .pptx in ~/Downloads are
  other projects), so current slide text is quoted only where verify.py records it (slide 8).

## Day 9 (feature freeze)
- Playwright WebKit 26.6 installed (78 MB, user approved); `BROWSER=webkit npm run test:e2e` 16/16.
- Fresh clone **from GitHub** at 62d6d49 into a scratch folder, new .venv, `npm ci` root + ui, pip --only-binary:
  check all met; verify PASS 67 | FAIL 6 (the expected six), 55.8 s wall (first run, libraries compiling);
  verify:coupling PASS 3; build; API ready 1.18 s; test:api all matching (G9/G10 true, cancel, 400/404, jobs saved);
  test:e2e 16/16; timing all within budget (Engine 1 0.29 s, Engine 2 1.65 s, sweep 5.59 s max).
- `docs/demo-script.md`: ~10 min click path with what to say and the numbers on screen, warm-up checklist, fallbacks,
  likely questions, rehearsal log. Screenshots in docs/screenshots/ are current (no UI change since 92dcd23).
- Timed rehearsals: the user's (log table in the script).

## Day 10 (gate G5, my side)
- Final run on the main checkout: verify PASS 67 | FAIL 6 (expected six) 38.2 s; verify:coupling PASS 3 10.5 s;
  test:api all matching; test:e2e 16/16.
- Definition of done: (1) API + built UI on :8787 yes; (2) five working pages yes; (3) acceptance numbers reproduced
  yes (Day 4 coupling, Day 7 results-data.json); (4) fresh clone passes verify, test:api, test:e2e yes (Day 9, from
  GitHub); (5) slide fixes and two rehearsals: the user's (checklist docs/slide-fixes.md, log in docs/demo-script.md).
- Tag v1.0 created locally on the final commit; pushing it waits for the user's approval (and for the rehearsals, in
  case they lead to changes: then the tag is moved before pushing).

## v1.1 (after Day 10, branch v2)
- Windows: fixed day1-check (shell only for npm), e2e /tmp path, screenshots URL.pathname; windows-latest CI passes
  every test (it checks result lines, since verify and test:api exit 0 even on wrong numbers).
- UI: light/system/dark toggle; ambient canvas (signal network + broadcast rings, page colour) behind frosted cards;
  motion; animated logo; sticky sidebar. Light secondary text slate-600 to keep >= 5.5:1 over the background.
- Docker: one image (Python 3.12 + node binary, UI built in stage 1), non-root, health check, ./results volume.
  Mac arm64: ready 1.5 s, e2e 19/19; CI amd64: 19/19. First local build ~9 min (Docker Hub at 70-100 KB/s here).
- Problems: e2e text matches found hidden pages / chart labels -> scoped locators (no expected values changed).
  The $15k coupling row is $2,336,994 on arm64 Docker (gap 0.1%), inside its 2.32-2.34M acceptance range.

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

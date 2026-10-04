# Two-week plan (one person), Days 3-10

10 working days; weekends are buffer. Each task is Must (needed for the definition of done) or Could (drop first
when a day overruns). Tick a task only when its closing test passes. Days 1-2 are done (see history.md).

## Definition of done (Day 10)
1. `npm run api` starts API + both engines; after `npm run build:ui`, http://localhost:8787 serves the whole app.
2. Five working pages: Overview, Pricing (Engine 1), Retention (Engine 2), Coupling, Data & checks.
3. The app reproduces the acceptance numbers below.
4. On a fresh clone: `npm run verify`, `npm run test:api`, `npm run test:e2e` all pass.
5. The nine slide fixes are in and the demo has been rehearsed twice.

## Gates
| Gate | End of | Passes when |
| --- | --- | --- |
| G1 Toolchain | Day 1 | done (tag g1-toolchain) |
| G2 Engines extended | Day 3 | sensitivity (done) and robustness calls reproduce checks F2, G9, G10 through the API |
| G3 All pages live | Day 5 | production build on :8787; browser test passes locally and from a fresh clone |
| G4 Fast, slides fixed | Day 8 | Engine 1 < 2 s, Engine 2 < 10 s, sweep < 60 s; two browsers checked; slide fixes in |
| G5 Demo-ready | Day 10 | fresh clone passes every test; tag v1.0 pushed; two rehearsals done |

## Day 3: Engine 2 robustness (gate G2)
- Must: worker op `robustness` + route `POST /api/engine2/robustness`. Re-solve Engine 2 with contract effects x0.5 and
  x0.25 (`haircut`) and acceptance 0.15 and 0.5, everything else as the request. For each case return: value, mix,
  share of the base call list's customers still called, share of those keeping the same offer.
  Reference (verify.py G9/G10, solver gap 0.01%, budget 30000 / hours 500 / cap 350):
  haircut 0.5 -> $152,666, 88% kept, 45% same offer; haircut 0.25 -> $126,886, 81% kept, 47% same;
  acceptance 0.15 -> $104,046, 80% kept; acceptance 0.5 -> $248,344, 95% kept.
  The interactive API uses a 0.1% gap, which can pick a different near-optimal list; either pass mipGap 0.0001
  for this call to reproduce the reference, or accept values within 0.1% and shares within a few points.
  5 solves per call: if it is slow, make it a background job like coupling.
- Must: robustness panel on the Retention page (value, % kept, % same offer per case).
- Must: a line in tests/api.test.mjs and a step in tests/e2e.test.mjs; run gate G2.

## Day 4: coupling
- Must: switch verify.py stage H to the 0.1% gap; sweep matches within 1% (see acceptance).
- Must: check the Coupling page against the acceptance table.
- Could: `DELETE /api/jobs/:id` and a cancel button.

## Day 5: production build and browser test (gate G3)
- Must: `npm run build:ui`, whole app works on :8787.
- Must: browser test covers the new panels; passes locally and from a fresh clone.
- Could: save finished job results to disk.

## Day 6: polish
- Must: loading, empty and error states on every page.
- Could: type scale, spacing, number formats, keyboard focus, contrast.
- Decided Day 6 (option 1): one shared settings panel so margin/discount/eta carry across pages; offer terms as inputs (option 2) not chosen. Original note: one shared panel, and offer
  terms become inputs. See decisions.md, known gaps.

## Day 7: report
- Must: methodology chapter (assumptions table + never-claim list from decisions.md).
- Must: results chapter with screenshots from the running app.

## Day 8: fast, slides fixed (gate G4)
- Must: time each call against the budgets above. Must: Chrome + one other browser. Must: nine slide fixes.

## Day 9: feature freeze
- Must: clone into a new folder, install, pass every test. Must: demo script and a timed rehearsal.

## Day 10: demo-ready (gate G5)
- Must: final `npm run verify` and `npm run verify:coupling`; tag v1.0; push. Must: second rehearsal, submit.

## Acceptance numbers (what the screens must show)
| Screen | Settings | Must show |
| --- | --- | --- |
| Overview | none | 7,043 customers; churn 26.5%; R2 0.9988; 740 candidates (current customers at >= 3%); month-to-month churn 42.7% |
| Pricing | eta 0.8, margin 70%, ceiling on | fibre -17.9% (churn ceiling); phone +12.5%; DSL -1.0%; add-ons +25%; revenue +3.5%; $164,816 per 1% churn room |
| Pricing | eta 1.5 | fibre -18.3% |
| Pricing | ceiling off | every price +15% |
| Pricing sensitivity | eta 0.4/0.8/1.2/1.5 | same pattern +U--UUUUUU; fibre -17.65/-17.89/-18.15/-18.34 |
| Retention | $30,000, 500 h, cap 350, acceptance 30% | $149,869 within 0.1% (Windows finds $149,866); 740 called; gap < 0.01%; greedy 8.25% worse; CSV 740 rows |
| Retention | contract effects x0.5 | $123,961 within 0.1% |
| Coupling | $0, $15k, $30k, $60k, $90k | net gain $1.29M, $2.27M, $2.94M, $2.99M, $2.99M, each within 1% |

v1.3 decision (2026-10-05, the user's): Engine 2 calls current customers only (Churn = No); the churn model is still fitted
on everyone. This replaced the Overview, Retention and Coupling rows above. Values before it, kept for reference (and
reproducible with `includeFormer: true`): 1,651 candidates; $182,949, 901 called, greedy 5.16% worse, CSV 901 rows;
x0.5 $152,666; coupling $1.29M, $2.32-2.34M, $3.15M, $3.28M, $3.30M. 557 of those 901 calls were to customers who had left.

## Slide fixes (deck)
7 tenure = exposure time in the hazard model; 8 churn 26.5% and 42.7/11.3/2.8% by contract (not 26.6% / 75%);
9 within fibre churn falls 56.6% -> 23.3% as bills rise; 10 one margin, costs fixed per service; 14 monthly hazard from
a piecewise-exponential model, price sensitivity a scenario input; 15 remove or redefine the bundle constraint;
17 expected value at 30% acceptance, effect lasting the offer term; 18 740 current customers at 3%, 3,952 eligible pairs, IP beats best greedy
by 8.25% (v1.3; was 9,124 pairs and 5.16%); 21 add SciPy SLSQP for Engine 1 (PuLP/CBC cannot solve nonlinear programs).

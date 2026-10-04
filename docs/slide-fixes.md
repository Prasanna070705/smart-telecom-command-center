# Slide fixes checklist (Day 8, gate G4)

The nine fixes from `docs/context/plan.md`. The deck file is not in this repository, so this lists **what each slide
must say** and **where the number comes from**; where `engine/verify.py` records the deck's current claim, it is
quoted. Check each box when the slide is edited. Rerun the source with `npm run verify` (stages A-G, I, J).

Never put on a slide: a measured price sensitivity; "offer X reduces churn by Y%"; "the campaign will save $..."
without "expected, at 30% acceptance"; an interior optimum from Engine 1's curvature; greedy matching the IP.

---

- [ ] **Slide 7: tenure is exposure time, not just a feature**
  - Say: "Tenure is how long we observed each customer. 7,043 customers give 227,990 customer-months at risk and
    1,869 departures. The hazard model uses tenure as exposure, with bands 1-6, 7-12, 13-24, 25-48, 49-72 months."
  - Source: D1 (events / exposure months = 1,869 / 227,990).

- [ ] **Slide 8: churn rates**
  - Deck now says **26.6%** (A5b, FAIL) → change to **26.5%** (1,869 of 7,043 = 26.54%).
  - Deck now says **75% of month-to-month customers left** (A7b, FAIL) → change to **42.7%**; one-year **11.3%**,
    two-year **2.8%**.
  - If the 75% was meant as "share of leavers who were month-to-month", the correct figure is **88.6%** (A8). Say
    which one you mean.
  - Source: A5, A7, A8.

- [ ] **Slide 9: fibre churn and bills**
  - Say: "Within fibre, churn falls from **56.6%** in the lowest-bill fifth to **23.3%** in the highest-bill fifth."
  - Add underneath: "Customers with higher bills have more services. This is a pattern across customers, not a
    response to price; no price ever changed in the data."
  - Source: A9; A11 (bill / (monthly charge × tenure) median 1.000).

- [ ] **Slide 10: margin and costs**
  - Say: "One margin m = 70% for every service. Unit costs are fixed per service: cost = (1 − m) × today's bill."
  - Remove any per-service margins or costs that move with price.
  - Source: decisions.md (Engine 1); margin is a manager input (slider 30-90% in the app).

- [ ] **Slide 14: churn model and price sensitivity**
  - Say: "Monthly churn hazard from a piecewise-exponential model (Poisson GLM on customer-months). Price sensitivity
    η is a **scenario input**, swept 0.4-1.5: it cannot be estimated, because no price ever changed."
  - The 0.4-1.5 range has no source: cite one, or label it "sensitivity range".
  - Show the result that makes this safe: the price pattern is the same at η 0.4, 0.8, 1.2, 1.5 (F2, `+U--UUUUUU`).
  - Source: D stage, F2; decisions.md.

- [ ] **Slide 15: bundle constraint**
  - **Remove it.** With additive bills it compares a sum to 90% of itself, so it can never bind.
  - Constraints that remain: each price within ±25%; each of the 322 baskets' bills within ±15% (bill shock);
    fibre ≥ DSL + $10; mean monthly churn ≤ today's (churn ceiling).
  - Add: "Without the churn ceiling every price rises 15%; the ceiling produces the answer." (F1)
  - Source: decisions.md (Engine 1); F1.

- [ ] **Slide 17: what the retention value means**
  - Say: "Expected value **$149,869** at **30% acceptance**, with each offer's effect lasting its term (12 or 24
    months for contracts, 6 months for free services)."
  - Replace any "will save" with "expected, under these settings".
  - If the slide shows discount cost: it is the revenue given up, rate × bill × months (two-year, $70 bill: **$252**,
    not $176 from the report formula).
  - Source: G2 (IP value $149,869, v1.3: current customers only); E6; decisions.md (Engine 2 corrections).

- [ ] **Slide 18: size of the problem and the IP vs greedy**
  - Say: "**740** current customers at ≥ 3% monthly churn risk (1,651 including those who already left), **3,952**
    eligible customer-offer pairs. The integer program beats the best of three greedy rankings by **8.25%**."
  - Say why only current customers: the churn model learns from everyone, but a campaign can only call people still
    with the company (v1.3 decision; before it, 557 of the 901 calls went to customers who had already left).
  - If the slide shows the candidate pool from the report (2,345 / 1,629), change to **2,396 / 1,651** (D6, FAIL).
  - Source: G1, G4, D6.

- [ ] **Slide 21: tools**
  - Add: "Engine 1 (nonlinear): **SciPy SLSQP**." PuLP/CBC cannot solve nonlinear programs.
  - Engine 2 in the app runs on **SciPy `milp` (HiGHS)**. If the slide names PuLP/CBC for Engine 2, change it to that.
  - Source: engine/engine1.py, engine/engine2.py.

---

## Also check (report numbers that may have been copied onto slides)

| Check | Wrong | Right |
| --- | --- | --- |
| B2b | fibre price ~$45 | $50.01 |
| D8 | mean implied lifetime ~32 months | not finite without shrinkage; median 67-68 months |
| D9 | month-to-month + fibre + e-check: churn 58%, tenure 14, hazard 6.0% | 60.4%, 19.4 months, 4.67% |

Screenshots for the slides: `docs/screenshots/` (regenerate with `npm run screenshots`).

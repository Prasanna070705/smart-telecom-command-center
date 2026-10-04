# Chapter: Methodology (draft)

> Draft for the report. Every figure is re-derived by `engine/verify.py` (76 checks) or produced by the running app;
> sources are given in brackets. Wording follows the "never claim" list at the end of this chapter.

## 1. Data

The IBM Telco customer churn file: 7,043 customers, 21 columns, no duplicate IDs. 1,869 customers (26.54%) left.
Churn differs sharply by contract: 42.71% of month-to-month customers left, 11.27% on one-year contracts and 2.83% on
two-year contracts. The 11 blank `TotalCharges` values are exactly the 11 customers with tenure 0.
[verify stage A]

**Churn label.** The dataset card says churn means "left in the last month", which the file contradicts
[verify stage A]. We read churn as *left at some point during the recorded
tenure*. This is a stated assumption.

**No price ever changed.** `TotalCharges / (MonthlyCharges × tenure)` has median 1.000: every customer paid the same
monthly bill throughout. Two-year customers who left never did so before month 25.

## 2. Recovering the price list

The bill is not itemised, so we recovered one price per service by least squares on the 322 distinct service baskets
(R² = 0.9988, residual SD $1.02, residuals uncorrelated with tenure or churn) [verify stage B]:

| Service | Price | Service | Price |
| --- | --- | --- | --- |
| Phone line | $20.05 | Online security | $5.01 |
| Multiple lines | $5.01 | Online backup | $4.99 |
| DSL internet | $25.05 | Device protection | $5.02 |
| Fibre internet | $50.01 | Tech support | $5.03 |
| Streaming TV | $9.97 | Streaming movies | $9.96 |

Bills are additive in these prices, so a customer's bill under a new price list P is B(P) = aᵢ·P, where aᵢ is the
customer's service basket.

## 3. Monthly churn hazard

Engine 1 and Engine 2 both need a *monthly* probability of leaving, not the "ever left" label. We fit a
piecewise-exponential model: a Poisson GLM on person-month exposure with tenure bands 1-6, 7-12, 13-24, 25-48 and
49-72 months (scikit-learn `PoissonRegressor`, no penalty, exposure weights). It matches the textbook offset GLM to
2×10⁻¹⁵. [verify stages D-E]

Selected hazard ratios: one-year contract 0.21, two-year contract 0.055, tech support 0.65, online security 0.52,
card autopay 0.52. The mean monthly hazard is 2.18% (median 0.89%); 1,651 customers have a monthly hazard of at
least 3% and form Engine 2's candidate pool.

These ratios are **associations in observational data**, not effects of an intervention: no customer was ever
offered a contract or a service to stay.

**Known flaw.** The model misses the two-year lock-in (it predicts 14.1 churn events in the first 24 months of
two-year contracts; there are 0). A contract × tenure-band model fixes the fit and changes no conclusion:
fibre −18.4% (vs −17.9%), Engine 2 value $200,904 with 86% of the same customers called. [verify stage I]

## 4. Engine 1: price optimizer (nonlinear program)

**Decision.** One price per service, P (10 prices).

**Objective.** Maximise total customer lifetime profit

  maximise Σᵢ (Bᵢ(P) − Cᵢ) / (d + hᵢ(P))

where Cᵢ = (1 − m) × today's bill (unit costs held fixed per service), m is the margin (70%), d the monthly discount
rate (1%), and hᵢ(P) = hᵢ₀ · (Bᵢ(P) / Bᵢ₀)^η is the customer's monthly hazard after the price change.

**Price sensitivity η cannot be estimated from this data.** No price ever changed, and the price coefficient flips
sign between model specifications. η is therefore a *scenario input*, swept from 0.4 to 1.5. (The range was carried
over from the earlier report and has no source; cite one or call it a sensitivity range.)

**Constraints.**
- each price within ±25% of today's;
- bill shock: each of the 322 baskets' bills moves by at most ±15%;
- fibre stays at least $10 above DSL;
- churn ceiling: the mean monthly hazard may not exceed today's.

The bundle constraint in the earlier report was dropped: with additive bills it compared a sum to 90% of itself and
could never bind.

**Solver.** SciPy SLSQP from 8 starting points; all 8 agree (spread 10⁻¹²). The Lagrange multiplier on the churn
ceiling gives the value of relaxing it: the *value of 1% churn room*.

**What drives the answer.** Without the churn ceiling every price rises to the +15% bill-shock limit. The ceiling,
not the curvature of the objective, produces the pattern in the results chapter.

## 5. Engine 2: retention offer optimizer (binary integer program)

**Decision.** For each of the 1,651 candidates, at most one of six offers: one-year contract, two-year contract,
6 months' free tech support, 6 months' free online security, autopay switch with a $25 credit, two-year contract plus
tech support. Eligibility follows the customer's current contract, services and payment method (e.g. no security
offer to someone who already has it): 9,124 eligible customer-offer pairs with a positive value.

**Value of an offer.** acceptance × (CLV with the offer's hazard path − CLV today), with CLV = π / (d + h) for
end-of-month cash flows and π = m × bill. The offer's hazard comes from the hazard model's ratios for the matching
attribute, and lasts only for the offer's term (12 or 24 months for contracts, 6 months for free services).

**Constraints.** One offer per customer; expected money cost ≤ budget ($30,000); agent hours ≤ 500 (0.5-1.0 h per
contact); at most 350 customers per offer.

**Corrections to the earlier report.**
- a discount's cost is the revenue given up, ρ × B × L (not × m);
- offer effects last the offer term, not forever;
- acceptance is 30% (EMPC literature, Beta(6,14) prior), not 100%;
- money cost is multiplied by acceptance; agent hours are spent on every contact.

**Solver.** SciPy `milp` (HiGHS). The app uses a 0.1% optimality gap and a 30 s limit; `verify.py` uses 0.01%. The
LP relaxation gives an upper bound. Three greedy rules (value per dollar, value per resource, value) are solved for
comparison.

**Robustness.** Contract effects are the most selection-prone (customers who chose long contracts were already less
likely to leave), so the app re-solves Engine 2 with the contract part of each effect cut to ×0.5 and ×0.25
("haircut"), and with acceptance 15% and 50%. It reports how many of the base list's customers are still called and
how many keep the same offer.

## 6. Coupling the two engines

Retention spend lowers churn for the customers called, which frees room under Engine 1's churn ceiling. For a given
retention budget:

1. Engine 2 picks the call list (hours = budget / 60, cap per offer = budget / 85.7).
2. Each called customer's offer value V is converted to an equivalent constant hazard
   h_eq = π / (CLV + V) − d.
3. Engine 1 is re-solved with these hazards and the churn ceiling held at **today's** mean hazard.

Net gain = lifetime profit at the new prices and hazards − retention spend − today's lifetime profit.

## 7. Verification

`engine/verify.py` re-derives every number above from the raw CSV: 76 checks. `npm run verify` runs 73 of them
(stages A-G, I, J) and `npm run verify:coupling` runs the other 3 (stage H). 70 pass. The 6 that fail are claims from
the earlier deck and report that the data contradicts:

| Check | Earlier claim | What the data gives |
| --- | --- | --- |
| A5b | churn 26.6% | 26.5% (correct rounding of 26.54%) |
| A7b | 75% of month-to-month customers left | 42.7% |
| B2b | fibre price ~$45 | $50.01 |
| D6 | candidate pool 2,345 / 1,629 at 2% / 3% hazard | 2,396 / 1,651 |
| D8 | mean implied lifetime ~32 months | infinite without shrinkage; median 67-68 months |
| D9 | month-to-month + fibre + e-check: churn 58%, tenure 14, hazard 6.0% | 60.4%, 19.4, 4.67% |

## 8. Assumptions

| Assumption | Value used | Source / status | How it is tested |
| --- | --- | --- | --- |
| Churn = left during recorded tenure | — | Reading of the file; the dataset card says otherwise | Stated; stage A |
| Price sensitivity η | 0.8 (range 0.4-1.5) | Not estimable from the data; range unsourced | Sensitivity panel: same pattern at 0.4, 0.8, 1.2, 1.5 |
| One η for every customer | — | Modelling choice | Not tested |
| Margin m | 70% | Manager input | Shared slider, 30-90% |
| Discount rate d | 1% per month | Manager input | Shared slider, 0.5-2% |
| Unit costs fixed per service | (1 − m) × today's bill | Modelling choice | Not tested |
| Offer effects = hazard-model ratios | e.g. two-year 0.055 | Associations, not measured effects | Haircut ×0.5, ×0.25 |
| Effect lasts the offer term | 6, 12, 24 months | Modelling choice | — |
| Acceptance rate | 30% | EMPC literature, Beta(6,14) | 15% and 50% |
| Offer terms and costs | 10%/12 mo, 15%/24 mo, 6 mo free, $25 credit, 0.5-1.0 h | Hard-coded in `engine2.py` | Not varied in the app |
| Budget, hours, cap | $30,000, 500 h, 350 | Manager inputs | Sliders; coupling sweep $0-90k |
| Coupling resources | hours = budget/60, cap = budget/85.7 | Scales the $30k case | — |

## 9. What this work must never claim

- A **measured** price sensitivity. η is a scenario input.
- "Offer X reduces churn by Y%." The hazard ratios are model associations; no offer was ever made.
- "The campaign will save $182,949." It is the expected value under the stated settings.
- That Engine 1's answer is an interior optimum from the objective's curvature. The churn ceiling produces it.
- That a greedy ranking matches the integer program. Greedy is 4-6% worse.

## 10. Known limits

- The hazard model misses two-year lock-in (section 3); the interaction model changes no conclusion.
- Offer terms are fixed in code, not inputs.
- At the app's 0.1% gap, Engine 2 can return a different near-optimal call list than at 0.01%: values agree within
  0.1% (e.g. contract effects ×0.5: $152,614 vs $152,666), coupling net gains within 1%.

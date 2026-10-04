# Modelling decisions, assumptions and limits

## Data facts (verified from the raw CSV)
7,043 x 21, no duplicate IDs; 11 blank TotalCharges = the 11 tenure-0 rows; 1,869 churners (26.54%); churn within
month-to-month / one-year / two-year = 42.71 / 11.27 / 2.83%; TotalCharges / (MonthlyCharges x tenure) median 1.000
(no price ever changed); two-year churners never before month 25; 322 distinct service baskets.
Prices recovered by least squares (R2 0.9988): phone 20.05, multiple lines 5.01, DSL 25.05, fibre 50.01,
add-ons ~5.0, streaming ~9.97. Residual SD $1.02, uncorrelated with tenure and churn.

## Decisions
- Churn label read as "left at some point in the recorded tenure" (the dataset card says "last month", which the
  file contradicts). Stated assumption.
- Monthly hazard: piecewise-exponential Poisson GLM on person-month exposure, bands 1-6, 7-12, 13-24, 25-48, 49-72,
  sklearn PoissonRegressor(alpha=0, solver newton-cholesky, weights = exposure). Equals the textbook offset GLM to
  2e-15. Hazard ratios: one-year 0.21, two-year 0.055, tech support 0.65, security 0.52, card autopay 0.52.
  Known flaw: misses two-year lock-in (0 events vs 14.1 predicted in first 24 months); a contract x band model
  changes no conclusion (fibre -18.4%, Engine 2 $200,904, 86% same customers).
- Price sensitivity eta is NOT estimable (price coefficient flips sign with the model). It is a scenario input,
  swept 0.4-1.5 (range carried from the earlier report, unsourced: cite a source or call it a sensitivity range).
  Hazard response h(P) = h0 (B(P)/B0)^eta.
- Engine 1: maximise sum (B(P) - C)/(d + h(P)), C = (1-m) x today's bill (unit costs fixed). Constraints: +/-25% price
  bound, +/-15% bill-shock per basket (322 baskets, model bills), fibre - DSL >= $10, mean hazard <= today's.
  Bundle constraint dropped (with additive bills it compares a sum to 90% of itself). Without the churn ceiling every
  price goes to +15%; the ceiling produces the answer. SLSQP multipliers give the ceiling's shadow price.
- Engine 2: 6 offers (1yr, 2yr, free tech 6 mo, free security 6 mo, autopay + $25 credit, 2yr + tech).
  Value = acceptance x (CLV with the offer's hazard path - CLV today); CLV = pi/(d+h), end-of-month.
  Corrections vs the earlier report: discount cost = forgone revenue rho x B x L (not x m); effects last the offer
  term; acceptance 30% (EMPC literature, Beta(6,14)); money cost x acceptance, agent hours per contact.
  Interactive solver gap 0.1%, time limit 30 s; verify.py uses 0.01%.
- Coupling: Engine 2 at a budget -> equivalent constant hazard h_eq = pi/(CLV + V) - d for called customers ->
  Engine 1 with the ceiling at today's level. Hours = budget/60, caps = budget/85.7.

## Never claim
Measured price sensitivity; "offer X reduces churn by Y%" (it is a model association); "the campaign will save
$182,949" (expected value under stated settings); an interior optimum from Engine 1's curvature (the ceiling does it);
greedy ranking matching the integer program (4-6% worse).

## Known gaps (open, not decided)
- Settings don't carry across pages: Retention and Coupling use their own margin 70% / discount 1%; Coupling ignores
  the Pricing eta slider (uses 0.8).
- Offer terms (10%/12 mo, 15%/24 mo, 6 months free, hours per offer, eligibility) are hard-coded in engine2.py.
- Coupling results depend on which near-optimal list the 0.1% gap returns ($15k row differed 0.66% on the Mac).

Contents

1. [The models at a glance](#glance)
2. [Shared inputs](#inputs)
3. [Engine 1: formulation](#e1)
4. [Engine 1: solution](#e1sol)
5. [Engine 1: sensitivity](#e1sens)
6. [Engine 2: formulation](#e2)
7. [Engine 2: solution](#e2sol)
8. [Engine 2: sensitivity](#e2sens)
9. [Coupling](#cp)
10. [Solution quality](#quality)
11. [Assumptions and limits](#limits)

Operations Research · technical companion · version 1.3.1

# The two optimisation models, written out in full

For each engine: the decision variables, the objective, every constraint and why it is there, the class of problem and the solver, the optimal solution, and how that solution responds when the inputs change.

**Where the numbers come from.** Numbers marked app are what the running app (v1.3.1) shows at its default settings. Numbers marked re-solve were computed for this page on 5 Oct 2026 by calling the project's own `engine1.py` and `engine2.py` with one input changed at a time. They are not shown in the app. Engine 2 re-solves use a 0.01% optimality gap.

**10**continuous prices in Engine 1

**646**Engine 1 constraints besides bounds

**3,952**binary variables in Engine 2

**748**Engine 2 constraints

Overview

## The models at a glance

|  | Engine 1: prices | Engine 2: retention offers |
| --- | --- | --- |
| Question | What should each of the 10 services cost? | Which at-risk customers should be called, and with which of 6 offers? |
| Decision variables | 10 continuous prices Pk | 3,952 binary xij (customer i gets offer j) |
| Objective | Maximise total customer lifetime profit | Maximise expected gain in customer lifetime value |
| Constraints | Price bounds (20), bill shock (644), fibre-over-DSL gap (1), churn ceiling (1, nonlinear) | One offer per customer (740), budget (1), agent hours (1), cap per offer (6) |
| Problem class | Nonlinear program (NLP): sum-of-ratios objective, not guaranteed concave | Binary integer program (BIP): a multiple-choice multidimensional knapsack |
| Solver | SLSQP (sequential quadratic programming), 8 starting points | HiGHS branch and bound with cuts, via SciPy `milp`; LP relaxation for the bound |
| Solve time | 0.26 s for 8 starts | 0.03 s LP, 0.48 s integer program |
| Sensitivity tools | Lagrange multiplier on the churn ceiling; re-solves over η and each limit | LP-relaxation duals; re-solves over budget, hours, caps, threshold; robustness cases |

The two are linked by the **coupling sweep**: Engine 2's retention spend lowers some customers' churn, which loosens Engine 1's churn ceiling, which lets prices rise. That is a sequential decomposition, not one joint model. Its limits are discussed in [Coupling](#cp).

Inputs

## Shared inputs: prices, churn hazard and lifetime value

Both engines rest on three quantities estimated from the 7,043-customer file. These are statistical estimates, not optimisation, but every coefficient in the two models comes from them.

### 1. Service prices by least squares

Each customer has a 0/1 service vector ai (phone, multiple lines, DSL, fibre, six add-ons). Regressing the monthly bill on these flags recovers one price per service, P0, with R² = 0.9988. A customer's bill at any price list is then linear in the prices:

Bi(P) = ai · P Bi0 = ai · P0

The 7,043 customers hold only 322 distinct service baskets. That matters for Engine 1: bill-shock limits are per basket, not per customer.

### 2. Monthly churn hazard

A piecewise-exponential survival model, fitted as a Poisson GLM on person-month exposure with tenure bands 1–6, 7–12, 13–24, 25–48 and 49–72 months. Fitting is maximum likelihood (a concave log-likelihood, solved by Newton's method). Each customer gets a monthly hazard

hi = exp( β0 + βband + Σf βf zif )

Mean 2.18%, median 0.89%. The coefficients become hazard ratios exp(β). The ones Engine 2 uses: one-year contract 0.21, two-year contract 0.055, tech support 0.65, online security 0.52, card autopay 0.52. These are associations in observational data; no customer was ever offered anything.

### 3. Customer lifetime value

With monthly margin π = m·B, a constant hazard h, discount rate d per month and cash at the end of each month, lifetime value is a geometric series:

CLV = Σt≥1 π (1−h)t−1 / (1+d)t = π / (d + h)

Both objectives are built from this formula. Defaults: margin m = 70%, d = 1% a month.

Engine 1

## Engine 1: formulation

A price rise earns more per month but shortens how long customers stay. Engine 1 balances the two over all 7,043 customers.

Decision variables

P = (P1, …, P10) one monthly price per service, continuous

Objective: maximise total lifetime profit

maxP Z(P) = Σi=1..7043 ( Bi(P) − Ci ) / ( d + hi(P) )

Ci = (1−m) Bi0

monthly cost to serve, held at today's level (a price rise does not change cost)

hi(P) = hi ( Bi(P) / Bi0 )η

hazard after the price change; η is the price sensitivity (default 0.8)

Constraints

0.75 Pk0 ≤ Pk ≤ 1.25 Pk0

(1) price bounds, k = 1..10: no service moves more than ±25%

0.85 Bb0 ≤ ub · P ≤ 1.15 Bb0

(2) bill shock, b = 1..322 baskets: no customer's bill moves more than ±15%

Pfibre − PDSL ≥ 10

(3) tier gap: the faster product stays at least $10 dearer

(1/N) Σi hi(P) ≤ H̄

(4) churn ceiling: mean monthly hazard no higher than today's, H̄ = 2.1774%

### Why each constraint is there

- **Price bounds** keep the answer inside the range where a single η is believable. They are a modelling guard, not a market fact.
- **Bill shock** stops any one customer's bill jumping, which in practice is what drives complaints and regulator attention. Because bills are additive, the 7,043 per-customer limits collapse to 322 basket limits, each linear in P, so 644 linear inequalities.
- **Tier gap** keeps the product ladder sensible: fibre must not become cheaper than DSL.
- **Churn ceiling** is a management rule: repricing may not raise average churn. It is the only nonlinear constraint, and it decides the answer (see below).

### What kind of problem this is

The objective is a **sum of ratios** (fractional programming). Each term's numerator rises with price and its denominator rises too, through hi(P). Such sums are not concave in general, so a local optimum is not automatically global. The ceiling function is convex in P when η ≥ 1 and concave when η \< 1. The solver therefore treats it as a general smooth NLP.

**Solver.** SLSQP solves a quadratic programming subproblem at each step, using a quasi-Newton approximation of the Hessian of the Lagrangian. Analytic gradients are supplied for the objective and every constraint. It is run from 8 starting points (today's prices, then 7 random points within ±10%). The objective is divided by today's profit so the numbers stay near 1.

**Optimality conditions (KKT).** At the optimum, the gradient of the objective equals a non-negative combination of the gradients of the active constraints:

∇Z(P\*) = Σactive λc ∇gc(P\*), λc ≥ 0, λc gc(P\*) = 0

Each multiplier λc is a **shadow price**: how much lifetime profit would rise if constraint c were relaxed by one unit.

Engine 1

## Engine 1: the optimal solution

At the defaults (η 0.8, margin 70%, discount 1%) app:

| Service | Today | Optimal | Change | Held there by |
| --- | --- | --- | --- | --- |
| Phone line | $20.05 | $22.56 | +12.5% | bill shock on the basket phone + multiple lines |
| Multiple lines | $5.01 | $6.27 | +25.0% | upper price bound |
| DSL internet | $25.05 | $24.81 | −1.0% | bill shock on the basket DSL + all six add-ons |
| Fibre internet | $50.01 | $41.06 | −17.9% | churn ceiling |
| Six add-ons (security, backup, device, tech, TV, movies) |  |  | +25.0% | upper price bound, all six |

Revenue rises 3.52%. Lifetime profit rises from $17,013,333 to $18,307,575 (+7.61%, +$1.29M). Mean hazard is exactly at the ceiling (ratio 1.0000). The fibre–DSL gap is $16.25, so the tier constraint is slack by $6.25 and its multiplier is zero.

### The answer is fixed by its active constraints

Count the active constraints: 7 upper price bounds, 3 bill-shock rows and the churn ceiling. That is 11 active constraints for 10 variables. Ten of them are independent: once multiple lines is at its bound, the phone + multiple-lines basket fixes the phone price; once the six add-ons are at their bounds, the DSL + add-ons basket fixes DSL; the ceiling then fixes fibre. The third bill-shock row (phone, lines, DSL and all add-ons) is tight automatically, because its bill is the sum of the other two baskets' bills.

So the optimum sits at a **vertex** of the feasible region, the same way an LP optimum does. Two consequences follow:

- The point is **degenerate** (more active constraints than variables). The split of multipliers across the three bill-shock rows is not unique, so this page measures the bill-shock limit by re-solving instead of quoting its multipliers.
- Changing the objective's coefficients does not move the prices, as long as every multiplier keeps its sign. This is the NLP version of an LP's range of optimality, and the sensitivity results below show it directly.

**The ceiling drives the result, not the curvature of the objective.** Remove the ceiling and every price rises to the +15% bill-shock limit: profit $19,988,232 (+17.5%), but mean churn rises to 1.118 times today's re-solve. Cutting fibre is how the model buys back churn room for raising everything else.

Engine 1

## Engine 1: sensitivity analysis

### Shadow price of the churn ceiling

The Lagrange multiplier on constraint (4) is λ = 7.57 × 10⁸ dollars per unit of mean hazard. In useful units app:

1% more churn room (H̄ × 1.01, i.e. 2.1774% → 2.1992%) ≈ **+$164,816** lifetime profit

Checked by re-solving re-solve: H̄ × 1.01 gives +$164,467 and H̄ × 0.99 gives −$165,168. The multiplier sits between the two, as it should for a smooth, slightly concave value function. Per 0.1 percentage point of mean monthly hazard the multiplier gives about $757,000, but that is a linear extrapolation over a larger step.

### Parametric analysis: moving the ceiling

Lifetime profit as the churn ceiling moves from 95% to 110% of today's mean hazard re-solve. The curve is nearly straight close to 100%, where the shadow price applies, and bends as other constraints start to bind.

| Ceiling | Lifetime profit | vs today | Revenue | Fibre | Phone | DSL | TV |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 95% | $17,269,518 | +1.51% | −1.79% | −24.1% | +7.7% | −15.0% | +25% |
| 98% | $17,976,523 | +5.66% | +1.40% | −24.2% | +12.5% | −1.0% | +25% |
| 99% | $18,142,407 | +6.64% | +2.46% | −21.0% | +12.5% | −1.0% | +25% |
| 100% | $18,307,575 | +7.61% | +3.52% | −17.9% | +12.5% | −1.0% | +25% |
| 101% | $18,472,042 | +8.57% | +4.59% | −14.7% | +12.5% | −1.0% | +25% |
| 102% | $18,635,820 | +9.54% | +5.67% | −11.6% | +12.5% | −1.0% | +25% |
| 105% | $19,123,139 | +12.40% | +8.91% | −2.0% | +12.5% | −1.0% | +25% |
| 110% | $19,824,175 | +16.52% | +13.64% | +11.2% | +15.0% | +7.4% | +15% |

Between 98% and 105% only fibre moves: the basis (the set of active constraints) is unchanged and fibre absorbs all the change in churn room. Below 98% fibre cannot fall further: the −15% bill-shock limit on the phone + fibre basket binds, so phone and DSL are cut instead. By 110% fibre is rising and the upper bill-shock limits replace the price bounds (TV drops back to +15%). Each of those is a **basis change**.

### Price sensitivity η

η cannot be estimated from this data (no price ever changed), so it is a scenario input. The app's Sensitivity panel re-solves at four values app:

| η | Pattern | Revenue | Profit uplift | Fibre |
| --- | --- | --- | --- | --- |
| 0.4 | +U--UUUUUU | +3.61% | +8.08% | −17.65% |
| 0.8 | +U--UUUUUU | +3.52% | +7.61% | −17.89% |
| 1.2 | +U--UUUUUU | +3.44% | +7.15% | −18.15% |
| 1.5 | +U--UUUUUU | +3.37% | +6.81% | −18.34% |

Pattern letters, one per service in the order phone, lines, DSL, fibre, then six add-ons: U = at the upper bound, + / − = moved up or down inside it. The same constraints are active at every η, so the recommendation is stable. η enters the churn ceiling itself, which is why fibre moves slightly: higher η means each price rise costs more churn, so fibre must fall a little further.

### The other limits, one at a time

All at η 0.8, everything else at the default re-solve.

| Limit | Value | Lifetime profit | vs today | Fibre | What changes |
| --- | --- | --- | --- | --- | --- |
| Bill shock | ±5% | $17,560,885 | +3.22% | −1.7% | binds hard; phone cannot move |
|  | ±10% | $18,036,391 | +6.01% | −8.4% |  |
|  | ±15% | $18,307,575 | +7.61% | −17.9% | default |
|  | ±20% | $18,463,934 | +8.53% | −25.0% | fibre reaches its price bound |
|  | ±25% | $18,463,934 | +8.53% | −25.0% | no longer binding |
| Price bound | ±15% | $17,888,270 | +5.14% | −15.0% |  |
|  | ±20% | $18,176,141 | +6.83% | −20.0% |  |
|  | ±25% | $18,307,575 | +7.61% | −17.9% | default |
|  | ±30% | $18,429,091 | +8.32% | −15.4% |  |
|  | ±40% | $18,559,931 | +9.09% | −11.9% | diminishing returns |
| Tier gap | $0 or $10 | $18,307,575 | +7.61% | −17.9% | slack (gap is $16.25) |
|  | $20 | $18,232,213 | +7.16% | −14.5% | binds: costs $75,362 |
|  | $25 | $18,072,930 | +6.23% | −7.4% | binds: costs $234,645 |

### Margin and discount rate

| Input | Value | Lifetime profit | vs today | Optimal prices |
| --- | --- | --- | --- | --- |
| Margin m | 50% | $13,476,696 | +10.90% | identical to the default |
|  | 90% | $23,138,455 | +5.78% | identical |
| Discount d | 0.5% / month | $29,507,496 | +8.03% | identical |
|  | 2% / month | $10,951,641 | +7.10% | identical |

Margin and discount rate change only the objective, not the feasible region. Because the optimum is pinned at a vertex, the prices do not move; only the size of the gain changes. A lower margin makes the uplift larger in percentage terms because the extra revenue is pure margin (costs are held at today's level) while the base profit is smaller.

Engine 2

## Engine 2: formulation

Given a budget and a call centre, pick at most one retention offer for each at-risk customer to maximise the expected gain in lifetime value.

### Candidates and offers

Candidates are the 740 customers who are **still customers** and have a monthly hazard of at least 3% (the churn model is fitted on all 7,043). Six offers:

| Offer j | Hazard during the offer | Term | Cost if accepted | Hours | Eligible if |
| --- | --- | --- | --- | --- | --- |
| One-year contract (10% off) | one-year ratio, 0.21 | 12 mo | 0.10 × B × 12 | 0.5 | month-to-month |
| Two-year contract (15% off) | two-year ratio, 0.055 | 24 mo | 0.15 × B × 24 | 0.75 | month-to-month or one-year |
| Free tech support | tech ratio, 0.65 | 6 mo | 6 × $5.03 × (1−m) | 0.5 | has internet, no tech support |
| Free online security | security ratio, 0.52 | 6 mo | 6 × $5.01 × (1−m) | 0.5 | has internet, no security |
| Autopay switch ($25 credit) | card autopay ratio, 0.52 | permanent | $25 | 0.5 | pays by electronic or mailed cheque |
| Two-year + tech support | both, then two-year | 6 + 18 mo | two-year + tech + $10 | 1.0 | both eligibilities |

Eligibility leaves 3,952 customer–offer pairs with positive value: one-year 737, two-year 740, tech 611, security 620, autopay 633, combination 611.

### Coefficients: value and cost of each pair

An offer changes the customer's hazard to h′ for the offer's term L, after which it returns to h. Lifetime value along that path is a sum of geometric pieces, with q = (1−h′)/(1+d):

CLVoffer = π/(1+d) · (1−qL)/(1−q) + qL · π/(d+h)

Vij = α ( CLVoffer − π/(d+h) )

expected value; acceptance α = 30%

cij = α × cost if accepted

expected money cost; a discount costs the revenue given up

tj

agent hours, spent on every call whether accepted or not

### The integer program

Decision variables

xij ∈ {0, 1} 1 if customer i is called with offer j; 3,952 variables

Objective

max Σi Σj Vij xij

Constraints

Σj xij ≤ 1 ∀i

(1) at most one offer per customer: 740 rows

Σij cij xij ≤ 30,000

(2) expected money budget, $

Σij tj xij ≤ 500

(3) agent hours

Σi xij ≤ 350 ∀j

(4) cap per offer: 6 rows (stock, staffing or policy limit)

### What kind of problem this is

Constraint (1) puts each customer's offers in a **choice group** (a generalised upper bound row), and (2)–(4) are shared resources. That is a **multiple-choice multidimensional knapsack problem**, which is NP-hard in general. In practice it is easy here: only 8 constraints link customers together, so the LP relaxation is almost integral.

**Solver.** HiGHS first solves the LP relaxation (0 ≤ x ≤ 1) for an upper bound, then branches on fractional variables and adds cutting planes until the best integer solution is within the set optimality gap of the bound (0.1% in the app, 0.01% in `verify.py`), or the time limit is hit. The app also runs three greedy rankings (value per dollar, value per resource, value) to show what a simple rule would get.

Engine 2

## Engine 2: the optimal solution

At $30,000, 500 hours, cap 350, acceptance 30% app:

**$149,869**expected value of the call list

**$149,872**LP bound: no list can beat this

**0.0021%**proven gap to the bound

**8.25%**how much worse the best greedy rule is

| Constraint | Used | Limit | Status |
| --- | --- | --- | --- |
| One offer per customer | 740 called | 740 | every candidate is called |
| Budget | $29,998 | $30,000 | binding |
| Agent hours | 477.5 h | 500 h | slack 22.5 h |
| Cap: two-year | 350 | 350 | binding |
| Cap: autopay | 350 | 350 | binding |
| Cap: two-year + tech | 40 | 350 | slack |
| Caps: one-year, tech, security | 0 | 350 | slack |

Value by offer: two-year $76,503, autopay $61,726, two-year + tech $11,640. Average expected cost $40.54 and 0.645 hours per call.

**Why the LP is almost integral.** A basic LP solution has at most as many fractional customers as there are linking constraints that bind. Here the LP relaxation has only 4 fractional variables, spread over 2 customers re-solve. Branch and bound only has to settle those two customers, which is why the integer program takes half a second.

**Why greedy loses 8.25%.** A greedy rule ranks pairs by one ratio and fills the budget, but it cannot weigh the budget, hours and caps together, and it cannot reassign a customer to a cheaper offer once the cap on a better offer is full. The integer program trades these off exactly.

Engine 2

## Engine 2: sensitivity analysis

### Dual values from the LP relaxation

The duals of the LP relaxation estimate what one more unit of each resource is worth re-solve:

| Constraint | Dual value | Meaning | Checked by re-solving the integer program |
| --- | --- | --- | --- |
| Budget | $1.59 per $ | an extra $1,000 is worth about $1,590 | $31,000 gives +$1,421 ($1.42 per $) |
| Agent hours | $0 | 22.5 hours spare | 550 and 600 hours: no change |
| Cap: two-year | $4.17 per slot | raising both caps by one is worth about $22.69 | cap 351 gives +$22 |
| Cap: autopay | $18.53 per slot |  |  |
| Other four caps | $0 | not binding |  |
| One offer per customer | mean $105.57 | positive for all 740: every candidate is worth calling |  |

**Why the budget dual ($1.59) differs from the re-solve ($1.42).** The LP value as a function of budget is piecewise linear and concave. Just below $30,000 its slope is $2.03 per $ (from $25,000 to $30,000); just above, $1.42 per $. $30,000 sits on a kink, and the dual reported there is one valid subgradient between the two slopes. For an integer program, duals are only a guide; re-solving is the check.

### Parametric analysis: the budget

Expected value of the optimal call list as the budget grows, hours fixed at 500 and caps at 350 re-solve. Concave, as a knapsack value function must be. It flattens at $157,194 once the 500 agent hours run out.

| Budget | Value | Extra value per extra $ | Called | Offer mix | Hours used |
| --- | --- | --- | --- | --- | --- |
| $10,000 | $97,733 | $9.77 | 740 | one-year 350, autopay 350, security 31, two-year 9 | 74% |
| $20,000 | $126,566 | $2.88 | 740 | autopay 350, two-year 214, one-year 176 | 85% |
| $25,000 | $139,710 | $2.63 | 740 | autopay 350, two-year 334, one-year 56 | 91% |
| $30,000 | $149,869 | $2.03 | 740 | two-year 350, autopay 350, two-year + tech 40 | 96% |
| $35,000 | $155,767 | $1.18 | 740 | two-year 350, autopay 305, two-year + tech 85 | 100% |
| $40,000 | $157,194 | $0.29 | 699 | two-year 350, autopay 223, two-year + tech 126 | 100% |
| $60,000 | $157,194 | $0 | 699 | same; only 67% of the budget is spent | 100% |

The binding constraint changes with the budget. Up to somewhere between $31,000 and $35,000 money is the bottleneck; after that agent hours are, and at $40,000 the solver calls 699 customers instead of 740 to free hours for the more valuable combination offer. As money loosens, the mix shifts from cheap offers (one-year contract) to expensive, stronger ones (two-year). That shift is why a fixed ranking rule cannot match the optimum.

### Hours, caps and the risk threshold

| Input | Value | Expected value | Called | Notes |
| --- | --- | --- | --- | --- |
| Agent hours | 400 | $142,488 | 626 | hours bind; $123 per extra hour up to 450 |
|  | 450 | $148,648 | 713 | hours stop binding at 477.5 |
|  | 500–600 | $149,869 | 740 | slack |
| Cap per offer | 250 | $143,924 | 740 | four offers used |
|  | 300 | $148,024 | 740 |  |
|  | 350 | $149,869 | 740 | two caps bind |
|  | 400 or 500 | $150,068 | 740 | caps stop binding (two-year 377, autopay 362) |
| Risk threshold | 2% | $178,643 | 860 | 1,184 candidates, 5,943 pairs; hours bind |
|  | 3% | $149,869 | 740 | 740 candidates |
|  | 4% | $112,911 | 512 | 512 candidates; everyone called |
| Margin | 50% / 90% | $106,963 / $192,834 | 740 | same offer mix; value scales with margin |
| Discount rate | 0.5% / 2% | $181,961 / $108,752 | 740 | same offer mix |

The threshold is the input that matters most at a fixed budget, because it changes the candidate set, not just the coefficients. Margin and discount rate rescale the values almost uniformly, so the same list stays optimal.

### Robustness to the uncertain inputs

The two least certain inputs are the offer effects (taken from observational hazard ratios) and the acceptance rate. The app's Robustness panel re-solves with the contract effects weakened (a haircut on the log hazard ratio) and with other acceptance rates app:

| Case | Value | Change | Called | Same customers | Same offer |
| --- | --- | --- | --- | --- | --- |
| Base (haircut ×1, acceptance 30%) | $149,869 |  | 740 |  |  |
| Contract effects × 0.5 | $123,961 | −17.3% | 740 | 100% | 84.9% |
| Contract effects × 0.25 | $97,650 | −34.8% | 740 | 100% | 75.4% |
| Acceptance 15% | $78,597 | −47.6% | 699 | 94.5% | 67.5% |
| Acceptance 50% | $201,495 | +34.4% | 739 | 99.9% | 55.2% |

**Who to call is robust; which offer to give is less so; how much it is worth is not.** Even with contract effects cut to a quarter, the same 740 customers are called. The dollar value moves almost one-for-one with the assumptions.

Coupling

## Coupling the two engines

Retention lowers the hazard of the customers who are called. That lowers the mean hazard, which loosens Engine 1's churn ceiling, which the shadow price says is worth about $165,000 per 1%. The coupling sweep measures this end to end.

For each budget b in {0, 15k, 30k, 60k, 90k}

1\. Engine 2 with budget b, hours b/60, cap b/85.7

resources scaled in the same ratio as the $30,000 campaign

2\. hi′ = πi / (CLVi + Vi) − d

the constant hazard that gives the same lifetime value as the offer, for each called customer

3\. Engine 1 with h′, ceiling held at today's H̄

the freed churn room is spent on prices

Net gain = Z(P\*, h′) − spend − Z(P0, h)

compared with today's prices and no retention

Net gain against the retention budget app. The first $30,000 adds $1.64M on top of the $1.29M that repricing alone gives; beyond that, little is left to buy.

| Budget | Spent | Offer value | Mean hazard drop | Fibre price | Net gain |
| --- | --- | --- | --- | --- | --- |
| $0 | $0 | $0 | 0% | −17.9% | $1,294,242 |
| $15,000 | $14,999 | $89,635 | 5.2% | −0.5% | $2,266,626 |
| $30,000 | $29,998 | $149,869 | 9.1% | +11.0% | $2,938,892 |
| $60,000 | $56,071 | $168,068 | 9.6% | +12.3% | $2,991,376 |
| $90,000 | $56,071 | $168,068 | 9.6% | +12.3% | $2,991,376 |

The mean hazard drop column is re-solve; the rest is app. At $60,000 every candidate already has their best offer and $56,071 is all that can usefully be spent, so $90,000 changes nothing: the one-offer-per-customer rows are the binding constraints.

**Reading it through the shadow price.** $30,000 of retention lowers mean hazard by 9.1%. With the ceiling held at today's level, that is roughly the same as loosening the ceiling by 10% (1 / 0.909 ≈ 1.10), and Engine 1 with a 10% looser ceiling earns $19.82M, $2.81M above today (see the ceiling table). The coupled net gain of $2.94M is that effect plus the offers' own value, less their cost. Most of the coupled gain is **price room**, not the direct value of the offers.

**Limits of the coupling.** It is a one-pass sequential decomposition, not a joint optimum. Engine 2 picks offers without knowing that prices will then change, and Engine 1 treats the offers as fixed. Iterating the two, or writing one mixed-integer nonlinear model, could find a better combined plan; neither is done here.

The large gain depends on two things: the churn ceiling being a firm management rule, and η = 0.8. If the ceiling is not a real rule, the price room has no value.

Verification

## How we know the solutions are right

| Check | Engine 1 | Engine 2 |
| --- | --- | --- |
| Feasibility | largest constraint violation 3.5 × 10⁻¹⁸ | each constraint re-checked on the chosen list: all satisfied |
| Optimality | 8 of 8 starts reach the same prices (spread 1.2 × 10⁻¹²); KKT multipliers non-negative | proven within 0.0021% of the LP bound |
| Shadow prices | ceiling multiplier matches a ±1% re-solve within 0.3% | cap duals match a +1 re-solve ($22.69 vs $22) |
| Benchmark | no ceiling: every basket at +15%, as theory predicts | best greedy rule 8.25% worse |
| Independent re-derivation | `engine/verify.py` recomputes every figure from the raw file: 76 checks, 70 pass, and the 6 that fail are earlier claims the data contradicts |  |
| Cross-platform | Mac, Windows (CI) and Docker give the same results; Windows finds $149,866 for Engine 2, within the 0.1% gap |  |

Multistart agreement is strong evidence of a global optimum for Engine 1, but not a proof: the problem is not convex. For Engine 2 the LP bound is a proof: no feasible list can be worth more than $149,872.

Honesty

## Assumptions and limits

| Assumption | Status | How it is tested |
| --- | --- | --- |
| Price sensitivity η = 0.8, one value for everyone | not estimable from this data; a scenario input | η sweep 0.4–1.5: same constraints active |
| Offer effects equal hazard-model ratios | associations, not measured effects | haircut ×0.5 and ×0.25 |
| Acceptance 30% | literature prior, Beta(6, 14) | 15% and 50% |
| Costs to serve fixed at today's level | modelling choice | not tested |
| Churn ceiling at today's mean | management rule | ceiling 95–110%, and no ceiling |
| Margin 70%, discount 1% a month | manager inputs | prices and the call list unchanged across 50–90% and 0.5–2% |
| Offer terms, costs and hours | fixed in code | not varied |

- **Deterministic models.** Both engines optimise expected values. Uncertainty is handled by scenario re-solves, not by stochastic or robust optimisation. A chance constraint on churn, or a robust counterpart over the hazard ratios, would be natural extensions.
- **Single period.** Prices are set once and offers are made once; nothing is re-optimised as customers respond.
- **Duals for an integer program are approximate.** Every Engine 2 dual on this page was checked by re-solving the integer program.
- **What must never be claimed:** a measured price sensitivity; "offer X reduces churn by Y%"; that the campaign *will* save $149,869 (it is an expected value under the stated settings); or that Engine 1's answer comes from the curvature of the objective (the churn ceiling produces it).
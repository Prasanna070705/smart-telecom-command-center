Contents

1. [Key facts](#keyfacts)
2. [Is it done?](#status)
3. [The question and the data](#question)
4. [How the system fits together](#system)
5. [From bills to churn risk](#risk)
6. [Engine 1: prices](#engine1)
7. [Engine 2: who to call](#engine2)
8. [Robustness](#robust)
9. [Coupling](#coupling)
10. [OR concepts used](#or)
11. [The app, page by page](#tour)
12. [How it is checked](#checks)
13. [Where it runs](#runs)
14. [Assumptions and limits](#limits)

Operations Research · project guide · version 1.3.1

# Smart Telecom Command Center

Two optimisation engines on IBM's Telco churn data: one decides what each of ten services should cost, the other decides which at-risk customers to call with which retention offer. A third piece links them. Every screenshot below comes from the live app at [smart-telecom-command-center.onrender.com](https://smart-telecom-command-center.onrender.com) at its default settings.

Read this first

## Key facts

- **Prices (Engine 1):** add-ons +25%, phone +12.5%, fibre **−17.9%**; revenue +3.5%, modelled lifetime profit **+7.6%**, with churn held at today's level. The churn ceiling is what forces the fibre cut. Prices are set for all 7,043 customers.
- **Calls (Engine 2):** with $30,000 and 500 agent hours, call all **740 current customers** at 3%+ monthly risk for an expected **$149,869**. Only customers still with the company can be called (v1.3); the churn model still learns from everyone.
- **Coupling:** retention spend frees room to raise prices; net gain rises from **$1.29M** with no budget to **$2.94M** at $30,000 and levels off near **$2.99M**, because only about $56,000 can be spent on 740 customers.
- **Never measured:** price sensitivity and offer effects are assumptions, tested at other values. Every money figure is an expected value under the stated settings, not a forecast.
- **Checked:** 76 automated checks rebuild every number from the raw data; one customer was also worked through by hand, and every figure matched the app to the cent.

Status

## Is it done?

**In plain words.** Yes. The app is built, tested, online and matches every number it was supposed to produce. What is left is your part: fixing the slides, practising the demo and handing it in.

The build is done. Every part of the plan's definition of done that software can satisfy is met, and the work beyond the plan (Windows, themes, Docker, the live app, the showcase site) is finished and tested. What remains are the steps only you can take.

Done

**The app runs and reproduces every acceptance number** on a laptop, in Docker and on the live server: fibre −17.9%, $164,816 per 1% of churn room, $149,869 from 740 calls to current customers, and the coupling curve.

Done

**Five working pages:** Overview, Pricing, Retention, Coupling and the Index, which replaced Data & checks.

Done

**Every test passes** on macOS, and in fresh checkouts on Windows and Linux (Docker): 76 model checks (70 pass; the 6 failures are earlier claims the data refutes), the API test, and a 22-step browser test in Chromium and WebKit.

Done

**Shared:** a private code repository (tags v1.0 to v1.3.1; v1.3.1 is the current release), a live app on Render, and a public showcase site with a demo video and a "Your data" page.

Done

**Slow-server handling:** long runs show what they are solving and for how long, Engine 2 warns when a background run shares the server, a run lost to a server restart says so instead of freezing, and repeating a run with the same settings reuses the finished one instantly.

Done

**Only current customers are called (v1.3):** a hand check of the top customer showed the call list included people the data says had already left (557 of 901). Engine 2 now chooses only among current customers; the new results replace the old acceptance numbers, which are kept in the project notes.

Yours

**Edit the PowerPoint** using the nine-fix checklist (`docs/slide-fixes.md`), **check Safari by hand**, **rehearse twice** with the timed script (`docs/demo-script.md`), and **submit**.

Optional

**Uploading your own customer data** is specified on the showcase site's "Your data" page but not built. It would be the next piece of work, not part of this project's definition of done.

Context

## The question and the data

**In plain words.** A phone and internet company is losing customers. It can change its prices, and it can call customers who look likely to leave and offer them a deal. This project uses maths to decide the best prices and the best calls, using real-looking data on 7,043 customers.

A telecom company wants to keep more of its customers and earn more from them. Two decisions pull against each other: raising prices brings in more per customer but makes some leave, while retention offers keep customers but cost money. The project answers both as optimisation problems and then asks how they interact.

The data is IBM's public Telco churn sample: one row per customer with their contract, payment method, the services they hold, their monthly bill, how long they have been a customer, and whether they left.

**7,043**customers, 21 columns

**26.5%**left during their recorded time

**42.7%**of month-to-month customers left (2.8% on two-year contracts)

**740**current customers with a monthly churn risk of 3% or more (1,651 counting those who left)

![Overview page of the live app: customers, churn rate, price fit and retention candidates, the recovered price list and churn by contract](img/overview-page.jpg)

The Overview page: the customer base at a glance.

Architecture

## How the system fits together

**In plain words.** You use a website. When you press a button, the website asks a small server for the answer; the server hands the hard maths to Python programs that stay switched on and ready, and sends the result back to draw on the page.

Three layers, each with one job. The browser shows the pages and never computes a result. A small Node.js server receives each request, answers repeated ones from memory, and passes the rest to Python. Two long-running Python processes hold the data and the models in memory, so a solve starts in milliseconds instead of reloading everything.

### What happens when you press a Run button

1. The page sends your settings to the API, for example `POST /api/engine1` with price sensitivity, margin and bounds.
2. The API checks the request is well formed. If it has answered exactly the same request before, it replies at once from its cache.
3. Otherwise it writes one line of JSON to the interactive worker, which validates every number (a bad value comes back as a clear error, shown on the page) and runs the engine.
4. The answer goes back the same way and the page draws it. Slow work (the robustness check, the coupling sweep) goes to the second worker as a background job; the page polls its progress once a second and can cancel it.

**Sharing one small server.** The two Python workers run side by side, so on the free live server (a tenth of a CPU) an Engine 2 run and a coupling sweep slow each other down: in a test with the same limits (before v1.3, when the call list was larger), Engine 2 took 196 seconds instead of about 30 while a sweep ran. The page therefore shows each run's progress and elapsed time, warns on the Retention page when a background run is going, and the server hands back an identical run that is already going or finished instead of starting a second copy.

Every solve that uses the integer solver has a time limit (30 seconds on a laptop, 180 on the free live server). If the solver stops at that limit, the result says so and the page shows a notice, so a cut-short answer is never presented as the full one.

Data model

## From bills to churn risk

**In plain words.** Before deciding anything, the app works out two things the data does not say directly: what each service costs (the bills only show totals), and how likely each customer is to leave in any given month. Customers who pay month to month are by far the most likely to leave (42.7% did); customers on two-year contracts the least (2.8%).

Both engines need two things the file does not contain directly: the price of each service, and each customer's chance of leaving in a given month.

### Recovering the price list

The bills are not itemised. But customers hold different combinations of ten services, so a regression of each bill on the services held gives one price per service: phone $20.05, multiple lines $5.01, DSL $25.05, fibre $50.01, each add-on about $5, each streaming service about $10. These prices explain the bills almost exactly (R² 0.9988, a typical miss of about $1). No price ever changed over time: every customer paid the same bill each month. That fact matters later.

### Monthly churn risk

The file says whether a customer left at some point, not when. A **piecewise-exponential survival model** turns that into a monthly risk: each customer's history is split into months at risk, grouped into tenure bands (1-6, 7-12, 13-24, 25-48 and 49-72 months), and a Poisson regression estimates how contract, payment method, services and household details raise or lower the monthly rate.

hi = exp( band effect + contract + payment + services + household ) per month

The average customer has a 2.18% chance of leaving in a month (the median is 0.89%). 1,651 customers are at 3% or more; the 740 of them still with the company are the candidates for retention calls.

### Customer lifetime value

Both engines value a customer the same way. If a customer brings profit π each month and has a constant risk h of leaving, with future money discounted at rate d per month, the present value of everything they will bring is:

CLV = π / (d + h), π = margin × monthly bill

At a 70% margin, a 1% monthly discount rate and the average customer's risk, a $64.86 bill is worth about $1,430 over the customer's lifetime. Halving the risk raises that sharply, which is what both engines exploit.

Engine 1 · nonlinear program

## Engine 1: what should each service cost?

**In plain words.** Imagine changing the price tags on ten services. Higher prices bring in more money from each customer, but some customers leave because of them. Engine 1 finds the set of price tags that earns the most money over all customers' remaining time with the company, without letting more customers leave than leave today.

Engine 1 picks ten prices, one per service, to make total lifetime profit across all 7,043 customers as large as possible.

### How churn reacts to a new price list

When prices change, each customer's bill changes by the services they hold, and their churn risk rises or falls with it:

Bi(P) = sum of the prices of the services customer i holds\
hi(P) = hi × (Bi(P) / Bi)η

**η is price sensitivity.** It cannot be measured from this data, because no price ever changed, so it is a setting. The default is 0.8, and the sensitivity check tests 0.4 to 1.5.

### The problem it solves

maximise Σi (Bi(P) − Ci) / (d + hi(P)) with Ci = (1 − margin) × today's bill

Each term is one customer's lifetime profit at the new prices. Raising a price adds profit on every month a customer stays, but raises their risk and so shortens how long they stay. The engine must respect four rules:

- **Price bound:** each price within ±25% of today's.
- **Bill-shock cap:** no customer's total bill moves more than ±15%. This is checked for all 322 combinations of services that customers actually hold.
- **Tier gap:** fibre stays at least $10 above DSL.
- **Churn ceiling:** average monthly churn risk may not rise above today's.

### How it is solved

The problem is nonlinear (price appears in the profit and, through η, in the churn term), so it uses SciPy's **SLSQP**, sequential quadratic programming. It starts from eight different price lists. The answer is kept only if all eight converge to the same prices, which they do to twelve decimal places. The solver's Lagrange multiplier on the churn ceiling gives the value of relaxing it.

### The result

![Engine 1 headline numbers: revenue up 3.5%, lifetime profit up 7.6% to $18.31M, churn ratio 1.000 with the ceiling binding, value of 1% churn room $164,816](img/pricing-kpis.jpg)

Revenue +3.5%, lifetime profit +7.6% ($17.01M to $18.31M), churn held exactly at today's level.

Bar colour = what stops the price: indigo price bound (+25%) · grey bill-shock cap · amber churn ceiling

![Optimal price list table from the live app with current and new prices, change bars and the constraint that limits each price](img/pricing-table.jpg)

The price list as the app shows it, with what limits each price.

### Why fibre is cut, and why that is the key insight

Seven prices rise to their +25% bound and the phone line rises 12.5%. Each increase raises the risk of the customers who hold that service. The churn ceiling then forces the engine to buy that risk back somewhere, and the most profitable way the optimiser finds is to cut fibre: 17.9%, exactly enough to keep average churn at today's level. Switch the ceiling off and every price simply rises to the +15% bill-shock cap. **The churn ceiling produces the answer,** not the curvature of the profit function.

**Value of 1% churn room: $164,816.** If the business accepted one percent more average churn, the best prices would earn that much more lifetime profit. It prices the trade-off; it is not a recommendation.

### Does it depend on price sensitivity?

![Sensitivity table: the same price pattern at eta 0.4, 0.8, 1.2 and 1.5; fibre from −17.6% to −18.3%](img/pricing-sensitivity.jpg)

The same pattern at every tested η; only the size of the fibre cut moves (−17.6% to −18.3%).

Because η is a guess, the engine is re-solved at four values. The shape of the answer, which prices rise to their bound and which fall, is identical across the whole range. The recommendation does not depend on getting η exactly right.

Engine 2 · binary integer program

## Engine 2: who to call, with which offer

**In plain words.** A call centre has a fixed amount of money for discounts and a fixed number of staff hours. Engine 2 decides which of the 740 current customers most likely to leave should get a call, and which deal to offer each of them, so that the calls keep as much future profit as possible within that money and time.

Engine 2 builds a call list. For each of the 740 at-risk customers who are still with the company it decides whether to call them, and if so with which of six offers, within the budget, the agent hours and a cap on how many customers get the same offer.

### Who can be called

The data says whether each customer has already left. A campaign can only phone people who are still customers, so Engine 2 chooses only among the **740 current customers** whose monthly risk is 3% or more (1,651 customers are at that risk if you count those who left). The churn model still learns from all 7,043 customers: those who left are exactly what teaches it who leaves. Before this rule, the list was $182,949 from 901 calls, but 557 of those calls went to customers who had already left.

**Engine 1 is deliberately unchanged:** it still sets prices over all 7,043 customers, because a price list applies to the whole customer base, not just to people who might be called.

### The six offers

| Offer | What changes for the customer | Agent time | Cost if accepted | Expected cost |
| --- | --- | --- | --- | --- |
| One-year contract | 10% off for 12 months; churn risk of a one-year customer for the term | 30 min | $77.83 | $23.35 |
| Two-year contract | 15% off for 24 months; two-year risk for the term | 45 min | $233.49 | $70.05 |
| Free tech support | 6 months free; risk with tech support for 6 months | 30 min | $9.05 | $2.72 |
| Free online security | 6 months free; risk with security for 6 months | 30 min | $9.02 | $2.71 |
| Autopay switch | $25 credit; risk of an autopay customer, permanently | 30 min | $25.00 | $7.50 |
| Two-year + tech support | both of the above, plus a $10 premium | 60 min | $252.54 | $75.76 |

Costs are at the average bill of $64.86 a month. A discount costs the revenue given up (rate × bill × months); a free service costs its unit cost for six months. **Agent time is spent on every call; money is spent only when a customer accepts,** so the expected cost is the cost if accepted times the acceptance rate (30%, from published retention studies).

### The six offers in plain English

Each offer is a deal an agent can propose on the phone. The customer gets something; the company pays something; and because similar customers who already have that deal leave less often, the model expects the customer to be more likely to stay.

One-year contract

**The deal:** a customer who pays month to month agrees to a one-year contract and gets 10% off for those 12 months. **Who can get it:** month-to-month customers. **What it costs the company:** the 10% it gives up, about $78 for an average bill. **Why it might work:** customers on one-year contracts leave far less often than month-to-month customers.

Two-year contract

**The deal:** sign up for two years, get 15% off for 24 months. **Who:** month-to-month and one-year customers. **Cost:** about $233 for an average bill, the most expensive single offer. **Why:** two-year customers leave least of all; the effect lasts the two years.

Free tech support

**The deal:** six months of tech support for free. **Who:** internet customers who do not have it. **Cost:** only what it costs the company to provide it, about $9. **Why:** customers with tech support leave less often; the effect lasts the six free months.

Free online security

**The deal:** six months of online security for free. **Who:** internet customers without it. **Cost:** about $9. **Why:** customers with security leave less often, for the six months.

Autopay switch

**The deal:** a customer who pays by electronic or paper check switches to automatic card or bank payment and gets a one-off $25 credit. **Who:** customers paying by check. **Cost:** $25. **Why:** automatic payers leave less often; the model assumes the customer stays on autopay, so the effect is permanent.

Two-year + tech support

**The deal:** both the two-year contract and six months of free tech support. **Who:** month-to-month or one-year internet customers without tech support. **Cost:** both offers plus $10 for the bundle, about $253. **Why:** combines both effects, but it is the costliest and takes a full hour of agent time.

**What the optimiser actually chose** at the default settings: two-year contracts for 350 customers (the cap), autopay for 350 (the cap) and the two-year + tech support bundle for 40. The one-year contract and the free-service offers were not used: for these current customers the other offers keep more value within the same money and hours. Change the budget, hours or caps and the mix changes.

### What a call is worth

An offer lowers a customer's monthly risk to that of a customer who already has the contract or service, but only for the offer's term. Then it returns to where it was. The value of calling customer *i* with offer *j* is the expected gain in lifetime value:

Vij = acceptance × ( CLVi with offer j − CLVi today )

### The integer program

maximise Σ Vij xij where xij = 1 if customer i gets offer j, else 0

- **One offer each:** Σj xij ≤ 1 for every customer.
- **Budget:** Σ expected cost × x ≤ $30,000.
- **Agent hours:** Σ hours × x ≤ 500.
- **Cap per offer:** at most 350 customers get the same offer.

Only pairs where the customer qualifies (for example, no security offer to someone who already has it) and the value is positive are kept: 3,952 customer-offer pairs, each a yes/no decision.

### How it is solved

SciPy's **milp** function, which runs the **HiGHS** solver (branch and bound with cutting planes), searches for the best list and stops once it can prove it is within 0.1% of the best possible. The same problem with fractions allowed, the linear relaxation, is solved first: no real list can beat its value, so it measures how close the answer is. Three greedy rankings (by value per dollar, by value per resource, by value) are solved for comparison.

### The result

![Engine 2 headline numbers: value preserved $149,869, all 740 current at-risk customers called, optimality gap 0.002%, budget 100% and agent hours 96% used](img/retention-kpis.jpg)

All 740 current at-risk customers are called, preserving an expected $149,869, within 0.002% of the upper bound; the budget is fully used, and 96% of the agent hours.

![Offer mix: two-year contract 350, autopay 350, two-year plus tech support 40](img/retention-mix.jpg)

The offer mix: two-year contract 350 ($76,503), autopay 350 ($61,726), two-year + tech support 40 ($11,640).

![Campaign settings card: retention budget typed as 30000, agent hours, cap per offer, acceptance rate, risk threshold and contract-effect strength, each with a help line](img/retention-settings.jpg)

Campaign settings on the live app.

Retention budget

Typed in dollars ($0-1,000,000). Counted as expected spend: accepted offers' cost on average.

Agent hours

Total call-centre time; each call takes 30-60 minutes depending on the offer.

Cap per offer

Most customers who can get the same offer, so the campaign is not all one offer.

Acceptance rate

Share of called customers who say yes; 30% from published studies.

Risk threshold

Who counts as at risk: a monthly churn risk of 3% or more by default.

Contract-effect strength

How much of the contract effect to believe: ×1 all of it, ×0.5 half.

Per customer called, that is an expected $40.54 and about 39 minutes of agent time. **Ranking customers by score is 8.25% worse** under the same budget, hours and caps, which is why the list is optimised rather than sorted.

![Call list table: customer ID, offer, contract, monthly risk, cost and value, highest value first, with CSV export](img/retention-calllist.jpg)

The call list, highest value first, ready to export for the call centre.

**$149,869 is an expected value, not a forecast.** It assumes 30% of customers accept and that an offer changes churn the way the model associates that contract or service with churn, for the offer's term. Neither was measured: no offer was ever made in this data.

Engine 2 · robustness

## Does the call list survive weaker assumptions?

**In plain words.** Some inputs are educated guesses, like how many customers will say yes. This check asks: if those guesses are too optimistic, would we still call the same people? Mostly yes; the deal each person gets changes more.

The two softest inputs are the contract effects and the acceptance rate. Customers who chose long contracts were already less likely to leave, so part of the link between contracts and low churn is selection, not effect. The robustness check re-solves Engine 2 four times, everything else unchanged:

| Case | Value | vs base | Called | Still called | Same offer |
| --- | --- | --- | --- | --- | --- |
| Base (defaults) | $149,869 | - | 740 | - | - |
| Contract effects ×0.5 | $123,961 | −17.3% | 740 | 100.0% | 85.1% |
| Contract effects ×0.25 | $97,650 | −34.8% | 740 | 100.0% | 75.4% |
| Acceptance 15% | $78,597 | −47.6% | 699 | 94.5% | 67.5% |
| Acceptance 50% | $201,495 | +34.4% | 739 | 99.9% | 55.2% |

Still called: share of the base list's customers called again. Same offer: share of those given the same offer. From the live app, solved in 22 s at a 0.1% gap.

![Robustness table from the live app: value, change versus base, customers called, still called and same offer for four cases](img/retention-robustness.jpg)

The robustness panel on the live app.

**Who to call is robust:** 94-100% of the base list is called again in every case: with only 740 current candidates, nearly all of them get a call. **Which offer is not:** when contract effects are cut, 55-85% keep their offer, as customers move between the two-year contract and the two-year + tech support bundle. Treat the call list as the firm output and the offer as conditional on how much you believe the contract effect.

Coupling

## Coupling: retention money buys pricing room

**In plain words.** Calling customers keeps some of them. Because fewer leave, the company can afford to raise some prices without ending up with more customers leaving than today. The sweep asks, for different call budgets: once prices are reset to take advantage of this, how much better off is the company?

The two engines meet at the churn ceiling. Engine 1 may not raise average churn above today's, and that rule is what forces the fibre cut. Engine 2 lowers churn for the customers it calls. So spending on retention leaves room under the ceiling to raise prices. The coupling sweep measures how much.

### Turning a call's value into a lower churn risk

Engine 1 works with monthly risks, Engine 2 with values. The bridge is the constant monthly risk h′ that would give a called customer the lifetime value they have with the offer, expected value included:

π / (d + h′) = CLV + V ⇒ h′ = π / (CLV + V) − d

Each budget gets agent hours and a cap per offer in the same proportions as the $30,000 campaign ($60 per agent hour, $85.70 per offer slot). Engine 2 picks the list, every called customer's risk drops to h′, and Engine 1 is re-solved with the churn ceiling still at *today's* average, which is now easier to meet.

### The result

Net lifetime-profit gain against today's $17.01M, by retention budget (live app, drawn to scale)

![Sweep results table from the live app: budget, offer value, net gain and fibre price change](img/coupling-table.jpg)

The sweep results on the live app.

**With no retention budget**, pricing alone adds $1.29M: that is Engine 1's answer, fibre cut 17.9%. **At $15,000** the gain jumps to $2.26M and the fibre cut almost disappears (fibre -0.5%): the calls lowered churn enough that the ceiling barely needs it. **At $30,000** fibre rises 11% and the gain reaches $2.94M. **Beyond about $56,000 nothing more can be spent**: every current at-risk customer is already called, so $60,000 and $90,000 give the same $2.99M.

| Budget step | Extra net gain |
| --- | --- |
| $0 → $15,000 | +$0.97M |
| $15,000 → $30,000 | +$0.68M |
| $30,000 → $60,000 | +$0.05M |
| $60,000 → $90,000 | +$0.00M |

Net gain is already after the retention spend, so every step that spends money still pays, but almost all of the value comes from the first $30,000, and the size of the current at-risk base sets the ceiling. Like everything else here, it is an expected value under the stated assumptions.

Operations Research

## Which Operations Research concepts it uses

**In plain words.** Operations Research is the maths of making the best decision under limits. This project uses six of the ten topics on your syllabus: a nonlinear model for prices, an integer model for the calls, the linear version of that model as a benchmark, and sensitivity analysis throughout. Four topics are not used, because the problem has nothing to ship, route or rank by judgement; for each, here is why and where it could fit.

| Syllabus topic | Used? | Where |
| --- | --- | --- |
| Linear programming: formulation and solution; product mix, financial models | **Yes** | Engine 2's linear relaxation (the upper bound); Engine 2 as a product-mix model; lifetime value as a discounting (financial) model |
| LP sensitivity analysis, sensitivity reports | **Yes** | Shadow price of the churn ceiling ($164,816); binding constraints ("limited by"); parametric runs: η, robustness, budget sweep |
| Transportation and transshipment | No | Nothing is shipped from sources to destinations |
| Assignment models with different constraints | **Yes** | Engine 2 assigns customers to offers: at most one each, capacity per offer, plus budget and hours |
| Network optimisation (shortest route, spanning tree, max flow) | No | There is no network of routes or links |
| Integer programming models | **Yes** | Engine 2: 3,952 yes/no decisions, branch and bound, optimality gap |
| Specialised IP: knapsack, capital budgeting (and others) | **Yes** (knapsack, capital budgeting) | The budget is a knapsack constraint; choosing calls is capital budgeting. Set covering, fixed charge, facility location, TSP and cutting stock are not used |
| Nonlinear programming; managerial economics, portfolio models | **Yes** (managerial economics) | Engine 1: pricing with a churn (demand) response and an elasticity η. Portfolio models are not used, though Engine 1 has the same "maximise return within a risk limit" shape |
| Goal programming | No | The churn target is a hard constraint, not a goal with penalties |
| Analytic Hierarchy Process (AHP) | No | No judgement-based ranking of options |

### 1. Linear programming: formulation, solution and the indicative models

**The idea.** A linear program chooses numbers (decision variables) to maximise or minimise a linear objective, subject to linear limits. Spreadsheet courses formulate it with decision cells, an objective cell and constraint rows, and solve it with Excel Solver.

**Where it appears.** Engine 2, written with xij allowed to be any fraction between 0 and 1 instead of only 0 or 1, is a linear program: its objective (Σ Vij xij) and every constraint (one offer per customer, budget, hours, caps) are linear. The app solves this LP first. Its value, $149,872, is the **upper bound** shown as "LP bound": no real call list can beat it, because the real problem only removes options. The LP answer was already whole-number for all but 2 customers, which is why the integer answer ($149,869) is so close.

**Spreadsheet formulation.** The same model is a standard Solver layout: one row per customer-offer pair with a decision cell, its value, cost and hours; SUMPRODUCT cells for total value, cost and hours; one constraint row per customer and per offer. The project solves it in Python instead because it has 3,952 decision variables, far beyond the roughly 200 that Excel's standard Solver allows.

**Product mix model.** A product-mix model picks how much of each product to make to maximise profit within limited resources. Engine 2 is the same shape: the "products" are customer-offer pairs, each with a profit (the value it preserves) and resource use (money and agent hours), and the cap per offer plays the role of a demand or capacity limit on each product line.

**Financial models.** Every value in the project is a present value: customer lifetime value discounts each future month's profit at 1% a month and weights it by the chance the customer is still there, CLV = π / (d + h). That is the same discounting logic as NPV and perpetuity models in financial planning, with the churn rate acting like an extra discount rate.

### 2. Sensitivity analysis and interpreting sensitivity reports

**The idea.** After solving, a sensitivity report tells you which constraints bind, what one more unit of a limited resource is worth (the shadow price, or dual value), and how far inputs can move before the answer changes.

**Shadow price.** The "value of 1% churn room", **$164,816**, is the shadow price of Engine 1's churn ceiling: how much more lifetime profit the best prices would earn if the ceiling were relaxed by 1%. Engine 1 is nonlinear, so it comes from the solver's Lagrange multiplier, the nonlinear counterpart of a dual value (Excel's GRG Solver shows the same quantity in its sensitivity report). The verification script checks it the direct way, by re-solving with 1% more room: $164,467, within 0.2%.

**Binding constraints.** The "limited by" column is a reading of which constraints are tight: seven prices sit at the +25% price bound, the phone line and DSL are held by the bill-shock cap, and fibre is set by the churn ceiling. A non-binding constraint has a zero shadow price; switching the ceiling off shows what happens when the most important binding constraint is removed: every price rises to the cap.

**Parametric analysis.** Integer programs have no sensitivity report (Solver warns that sensitivity reports are not meaningful with integer constraints), so the project does what a sensitivity report would otherwise tell you by re-solving at different inputs:

- **Price sensitivity η** at 0.4, 0.8, 1.2 and 1.5: the price pattern is unchanged across the range, the equivalent of "the optimal basis does not change within this range".
- **Robustness:** contract effects at ×0.5 and ×0.25, acceptance at 15% and 50%: values change, the list of customers mostly does not.
- **The coupling sweep** changes the budget, the right-hand side of the budget constraint, and traces the result. The slope between points is the marginal value of a retention dollar, which falls as the budget grows:

| Budget step | Extra net gain per extra dollar |
| --- | --- |
| $0 → $15,000 | $65 |
| $15,000 → $30,000 | $45 |
| $30,000 → $60,000 | $1.7 |
| $60,000 → $90,000 | $0 |

This is diminishing marginal returns, read exactly as you would read a falling shadow price on a resource constraint: past about $30,000, money stops being the scarce resource, and past about $56,000 its value is zero because there is no one left to call.

### 3. Assignment models with different types of constraints

**The idea.** The classic assignment model gives each agent exactly one job and each job exactly one agent. Course variants relax this: unbalanced problems, agents that can take several jobs, jobs that may stay unassigned, and extra side constraints.

**Where it appears.** Engine 2 assigns customers to offers with several of those variations at once: a customer may get **at most one** offer, or none (Σj xij ≤ 1, unbalanced); each offer can be given to many customers up to a **capacity** (the cap per offer, ≤ 350); and two **side constraints** link all assignments, the money budget and the agent hours. That combination is often called a generalised assignment problem with side constraints. It is also why it must be solved as an integer program: the side constraints break the special structure that lets a plain assignment model be solved as an LP.

### 4. Integer programming models

**The idea.** When decisions must be whole numbers or yes/no, the model is an integer program. It is solved by **branch and bound**: solve the LP relaxation, branch on a fractional variable (try it at 0, then at 1), and prune branches whose LP bound cannot beat the best whole-number answer found so far.

**Where it appears.** Every xij in Engine 2 is binary: you either make that call with that offer or you do not. The HiGHS solver runs branch and bound with cutting planes and stops when the gap between the best list and the best possible bound is under 0.1%; the app reports that **optimality gap** (0.002% at the defaults). The **time limit** is the practical side of branch and bound: on a slow machine the search may stop first, and the app then says the list is the best found, not proven. The comparison with three **greedy rankings** (8.25% worse) shows why integer programming is worth it: a simple sort cannot handle several limits at once.

### 5. Specialised integer programming: knapsack and capital budgeting

**Knapsack.** The knapsack problem fills a bag of limited weight with items of different value and weight to maximise total value. The budget constraint is exactly a knapsack: each call is an item, its expected cost is the weight, and the value it preserves is the item's value. With agent hours as a second limit it becomes a **multidimensional** knapsack, and with "at most one offer per customer" a **multiple-choice** knapsack (pick at most one item from each customer's group).

**Capital budgeting.** Capital budgeting chooses which projects to fund from a limited budget to maximise total NPV. Read each call as an investment: it costs money now (the offer) and returns a present value (the lifetime value it keeps). Engine 2 is a capital budgeting model over 3,952 small projects, with mutually exclusive alternatives (different offers to the same customer) and a second resource (staff time).

**Not used:** set covering (nothing has to be covered by at least one choice), fixed charge (no set-up cost for using an offer; it would fit if launching each offer had a fixed campaign cost), facility location, travelling salesman and cutting stock (nothing to locate, route or cut).

### 6. Nonlinear programming: managerial economics

**The idea.** When the objective or constraints are curved, the model is a nonlinear program. Managerial-economics models are the classic case: profit = price × quantity − cost, where quantity falls as price rises, so profit is a curve with a best point.

**Where it appears.** Engine 1 is that model for subscriptions. Raising a price raises each month's profit but shortens how long customers stay, through the response h(P) = h × (B(P)/B)η; η plays the role of a **price elasticity**. The objective, profit divided by (discount rate + churn risk), is nonlinear in the prices, and the churn ceiling is a nonlinear constraint. It is solved with SLSQP, a gradient-based method like Excel's GRG Nonlinear, from eight starting points (Solver's "multistart" option) because nonlinear solvers can stop at a local best. All eight agree.

**Marginal reasoning.** At the optimum each price stops where the extra profit from raising it is balanced by the extra churn it causes, unless a bound stops it first. That is the managerial-economics rule "raise price until marginal revenue equals marginal cost", with lost lifetime value as the marginal cost.

**Portfolio models** are not used. Engine 1 has the same structure, though: maximise return (lifetime profit) subject to a risk limit (average churn no higher than today), just as a portfolio model maximises return subject to a variance limit.

### Not used: transportation, networks, goal programming and AHP

- **Transportation and transshipment** move goods from supply points to demand points at least cost. Nothing here is shipped. A transportation model would fit if calls had to be routed between several call centres with different capacities and costs per call.
- **Network models** (shortest route, minimal spanning tree, maximal flow) need a network of nodes and links, such as cables or towers. The data has none; a network-planning extension (where to lay fibre) would use them.
- **Goal programming** would treat "keep churn at today's level" and "earn at least X" as goals with penalties for missing them, instead of the hard churn ceiling. It is a natural extension if management wants to trade the two off with priorities.
- **AHP** ranks options by pairwise judgements with a consistency check. It could weigh offers on qualitative criteria (brand image, customer experience) that the money-based model ignores; nothing in this project uses judgement-based weights.

**Methods from outside the syllabus** that the project also relies on: least-squares regression (to recover the price list), survival analysis with a Poisson regression (monthly churn risk), discounting (lifetime value), and greedy heuristics as a benchmark.

The app

## The app, page by page

**In plain words.** Five pages: an overview of the customers, one page for each engine, one for how they work together, and an Index that explains every term.

- **Shared assumptions** (top of Pricing, Retention and Coupling): price sensitivity, margin and discount rate. They apply to all three pages, and a result computed under different settings is marked "settings changed".
- **Overview:** the data at a glance (above).
- **Pricing:** Engine 1, its price list and the sensitivity check.
- **Retention:** Engine 2, the offer mix, the robustness check and the call list with CSV export.
- **Coupling:** the budget sweep, run as a background job with progress and a Cancel button.
- **Index:** every term, formula and method in plain language, plus the agent time and cost per offer. A "?" beside any label on the other pages jumps to its entry.

![Index page: agent time and cost per customer by offer](img/index-agents.jpg)

The Index: agent time and cost per customer, read from the engine's own settings.

The interface has light, dark and system themes, a slow animated "signal network" background in the colour of the current page, frosted cards, and motion that switches off when the system asks for reduced motion. Every result on every page comes from the API; the pages only display it.

Quality

## How it is checked

**In plain words.** Every number is recalculated from the raw data by an automatic checker, and robot tests click through the whole app in two browsers and on Windows and Linux every time the code changes.

### 76 model checks

A verification script re-derives every number from the raw file and compares it with the claim. 70 pass. The 6 that fail are claims from the earlier deck and report that the data contradicts, kept as visible failures:

| Earlier claim | What the data gives |
| --- | --- |
| Churn 26.6% | 26.5% (1,869 of 7,043) |
| 75% of month-to-month customers left | 42.7% |
| Fibre costs about $45 | $50.01 |
| Candidate pool 2,345 / 1,629 | 2,396 / 1,651 |
| Mean customer lifetime about 32 months | not finite without adjustment; median 67-68 months |
| Month-to-month + fibre + e-check: churn 58%, tenure 14, risk 6.0% | 60.4%, 19.4 months, 4.67% |

### Tests

- **API test:** every reference number through the real server, including bad input (rejected with a clear message), job cancel, and the solver time-limit flag.
- **Browser test:** 26 steps in a real browser, Chromium and WebKit (Safari's engine), from page load to CSV export, themes and the Index links.
- **Automatic runs on every change:** the whole suite on a Windows machine, and the Docker image on Linux, both on GitHub.

### Speed

| Where | Engine 1 | Engine 2 | 5-budget sweep |
| --- | --- | --- | --- |
| **Budget (demo laptop)** | \< 2 s | \< 10 s | \< 60 s |
| MacBook Air, Docker, no limits (v1.2) | 0.3 s | 1.7 s | 5.5 s |
| GitHub Linux, Docker (v1.2) | 0.35 s | 2.2 s | 6.9 s |
| GitHub Windows (v1.2) | 0.9 s | 3.4 s | 11.1 s |
| Live, Render free (0.1 CPU), v1.3 | 3.4 s | 8.3 s | 28 s |

Every laptop and CI machine meets the speed budgets. On the free live server (a tenth of a CPU) Engine 2 and the sweep now meet them too, because v1.3's call list is less than half the size; Engine 1 still takes about 3 seconds there. One fix made a large difference everywhere: the maths libraries run on one thread per process, since their default of one thread per core made Engine 1 up to 40 times slower under a CPU quota.

Deployment

## Where it runs

**In plain words.** On your laptop (fastest), in a self-contained package called Docker, and on a free public server anyone can open.

- **On a laptop:** `npm run api`, then open `http://localhost:8787`. This is the fastest way to demo.
- **In Docker:** `docker compose up --build`. One image holds the server, both Python workers and the built pages. It is ready about 1.5 seconds after starting.
- **Live:** [smart-telecom-command-center.onrender.com](https://smart-telecom-command-center.onrender.com), on Render's free plan (a tenth of a CPU, 512 MB). It sleeps after 15 minutes without visitors and takes about 2 minutes to wake. The solver time limit there is 180 seconds, so its results match the laptop's exactly.
- **Showcase:** [prasanna070705.github.io/smart-telecom-showcase](https://prasanna070705.github.io/smart-telecom-showcase/), the public page for your portfolio, with the demo video and a "Try it live" button. The code itself stays in a private repository.

Honesty

## Assumptions and what is never claimed

**In plain words.** Some inputs could not be measured from the data, so they are clearly labelled guesses and tested at other values. The project never presents a guess as a measured fact.

| Assumption | Value | Status |
| --- | --- | --- |
| Churn means "left during the recorded tenure" | - | a reading of the file; the dataset card says otherwise |
| Price sensitivity η | 0.8 (0.4-1.5) | not measurable here; tested across the range |
| Offer effects | model associations | not measured; stress-tested at ×0.5 and ×0.25 |
| Acceptance rate | 30% | published studies; tested at 15% and 50% |
| Margin, discount rate | 70%, 1% a month | manager inputs |
| Budget, hours, cap | $30,000, 500 h, 350 | manager inputs |

The project never claims a measured price sensitivity, never says an offer "reduces churn by X%", never presents $149,869 as money the campaign will save (it is an expected value under these settings), never attributes the price answer to the profit curve's shape (the churn ceiling produces it), and never says ranking customers by score is as good as the optimiser (it is 4-6% worse).
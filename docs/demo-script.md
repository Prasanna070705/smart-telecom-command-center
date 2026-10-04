# Demo script (about 10 minutes)

Live demo of the running app at http://localhost:8787, default settings throughout. Every number below is what the
app shows at defaults (`docs/report/results-data.json`); if a number on screen differs, say so rather than reading
this sheet. Screenshots of every page are in `docs/screenshots/` as a fallback.

## Before the audience arrives (10 minutes ahead)

- [ ] `source .venv/bin/activate && npm run api` in its own terminal. On a machine where the libraries were just
      installed, the first start takes 30-40 s; afterwards ~1.5 s. Wait for "Engines ready" (green, top right).
- [ ] Open http://localhost:8787 in Chrome, full screen, zoom 100%. Close other tabs.
- [ ] Warm-up: run Engine 1, Engine 2 and a $0, $15,000 coupling sweep once, then reload the page. The API caches
      identical requests, so the live runs answer instantly.
- [ ] Shared assumptions at defaults: η 0.8, margin 70%, discount 1.00% / month (use "Reset to defaults" if shown).
- [ ] Open `docs/screenshots/` in Finder in case the app fails.

## 1. The problem and the data (Overview, 1 min)

**Click:** Overview.

**Say:** "IBM's Telco file: 7,043 customers, 26.5% left. Month-to-month customers left at 42.7%, two-year customers
at 2.8%. The bill isn't itemised, so we recovered a price for each of ten services; that price list explains the
bills with R² 0.9988. 740 customers who are still with us have a monthly churn risk of 3% or more; those are our retention candidates."

**Point at:** the four KPIs, then the churn-by-contract bars.

## 2. Engine 1: what should each service cost? (3 min)

**Click:** Pricing → Run Engine 1.

**Say:** "Engine 1 is a nonlinear program: it sets ten prices to maximise lifetime profit, with each price within
±25%, no customer's bill moving more than 15%, fibre at least $10 above DSL, and one more rule: average churn may not
rise above today's."

**Point at:** the price list. "The add-ons go up 25%, the phone line 12.5%, and fibre comes *down* 17.9%. Revenue
+3.5%, lifetime profit +7.6%, churn exactly at today's level."

**Say (the key point):** "Fibre is cut because of the churn rule. Switch it off" (untick *Hold churn at today's
level*, Run) "and every price simply rises 15%. The churn ceiling produces the answer." (Tick it again, Run.)

**Point at:** Value of 1% churn room, $164,816. "That is what each extra point of churn the business would accept is
worth. It prices the trade-off; it is not a recommendation to accept more churn."

**Click:** Run sensitivity. **Say:** "We cannot measure how customers react to price: no price ever changed in this
data. So price sensitivity η is a setting. Re-solved at four values from 0.4 to 1.5, the pattern is identical; only
the fibre cut moves, from −17.6% to −18.3%."

## 3. Engine 2: who to call, with which offer (3 min)

**Click:** Retention → Run Engine 2.

**Say:** "Engine 2 is a binary integer program: for each of the 740 at-risk customers who are still with us, at most one of six offers,
within $30,000, 500 agent hours and 350 customers per offer."

**Point at:** "All 740 called, $149,869 of lifetime value preserved, within 0.002% of the best possible. A
greedy ranking would be 8.3% worse." Then the offer mix: two-year 350, autopay 350, two-year + tech support 40.

**If asked why only 740:** "Customers who already left can't be called. The churn model still learns from them, but the
call list only includes people still with the company."

**Say (always with it):** "$149,869 is an expected value: it assumes 30% of customers accept, and that an offer
changes churn the way our model associates that contract or service with churn, for the offer's term. Neither was
measured; no offer was ever made in this data."

**Click:** Run robustness (about 6 s; talk while it runs). **Say:** "So we stress those two assumptions. Cut the
contract effects to half or a quarter, or move acceptance to 15% or 50%: 94 to 100% of the same customers are still
called. Which offer they get is less stable: 55 to 85% keep it. The call list is the firm output; the offer is
conditional."

**Optional (10 s):** Export CSV. "The call centre gets this file: 740 rows."

## 4. Coupling: retention money buys pricing room (2 min)

**Click:** Coupling → Run sweep (about 5 s).

**Say:** "Spending on retention lowers churn among the customers we call, which leaves room under the churn rule to
raise prices. Engine 2 at each budget, then Engine 1 on the lower churn."

**Point at:** "No retention budget: $1.29M net gain from pricing alone. $15,000: $2.27M, and the fibre cut is almost
gone. $30,000: $2.94M, fibre now up 11%. Beyond that, almost nothing: $2.99M at $60,000 and the same at $90,000,
because every current at-risk customer is already being called. These are net of the retention spend."

## 5. How we know the numbers are right (Index, 30 s)

**Click:** Index, then scroll to "Assumptions, limits and verification" at the bottom.

**Say:** "Every number is re-derived from the raw file by 76 automated checks. 70 pass; the 6 that fail are claims
from our earlier deck and report that the data contradicts, and we corrected them. And these are the assumptions
behind every number."

## Close (30 s)

"Two optimisation engines on one dataset: prices limited by a churn ceiling, a call list that holds up under weaker
assumptions, and a modelled link between them: retention spend buys pricing room, with most of the gain in the
first $30,000."

---

## If something goes wrong

| Problem | Do this |
| --- | --- |
| Header says "Engines starting" | Wait; first start after install takes 30-40 s. |
| Page shows `{"error":"UI not built..."}` | `npm run build:ui`, reload. |
| Port 8787 busy on start | `kill $(lsof -t -iTCP:8787 -sTCP:LISTEN)`, then `npm run api`. |
| A sweep or robustness run hangs | Press Cancel; the jobs worker restarts in ~2 s. Then show the screenshot. |
| Anything else | Switch to `docs/screenshots/` and continue from the script. |

## Likely questions

- **"How sensitive are customers to price?"** We can't measure it from this data; no price ever changed. That's why
  η is a setting and why we show the answer doesn't change across 0.4-1.5.
- **"Does a two-year contract really cut churn by 95%?"** No such claim. Two-year customers churn far less in the
  data (hazard ratio 0.055), but they chose those contracts; it's an association. That's what the robustness panel
  stresses.
- **"Why not just rank customers by risk?"** The best of three greedy rankings is 8.25% worse than the integer
  program under the same budget, hours and caps.
- **"Is the fibre cut a recommendation?"** Only under the rule that churn may not rise. Without it, every price
  rises 15%. With $30,000 of retention spend, fibre rises instead.
- **"Where does 30% acceptance come from?"** The EMPC literature (a Beta(6,14) prior); not from this data. The
  robustness panel shows 15% and 50%.

## Rehearsal log

| Rehearsal | Date | Total time | Overran at | Fix for next time |
| --- | --- | --- | --- | --- |
| 1 | | | | |
| 2 | | | | |

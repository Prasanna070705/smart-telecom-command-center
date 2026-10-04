import { Card, Badge, MetaGate } from '../components/ui.jsx'
import { money, int, cents } from '../format.js'
import { RETENTION_DEFAULTS as R } from '../settings.js'

// The Index: what every term means, the formulas behind each number, how each is computed, and what an agent and a
// customer cost per offer. Numbers come from /api/meta (offer facts are read from Engine 2's own defaults).

const pct = (v, d = 0) => `${(100 * v).toFixed(d)}%`
const F = ({ children }) => <div className="my-2 overflow-x-auto rounded-lg bg-slate-100/80 px-3 py-2 font-mono text-[13px] text-slate-800 dark:bg-slate-800/80 dark:text-slate-100">{children}</div>

function Term({ id, name, where, children }) {
  return (
    <div id={`term-${id}`} className="scroll-mt-24 rounded-lg px-3 py-2.5 target:bg-amber-50 target:ring-1 target:ring-amber-200 dark:target:bg-amber-500/10 dark:target:ring-amber-500/30">
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{name}{where && <span className="ml-2 text-xs font-normal text-slate-600 dark:text-slate-400">{where}</span>}</p>
      <div className="mt-1 text-sm text-slate-700 dark:text-slate-300">{children}</div>
    </div>
  )
}

const SECTIONS = [['use', 'How to use the app'], ['agents', 'Agent time and cost per customer'], ['terms', 'Terms'], ['formulas', 'Formulas'], ['methods', 'Methods'], ['limits', 'Assumptions, limits and verification']]

function Body({ meta }) {
  const d = meta.offerDefaults, c = meta.coupling
  return (
    <div className="space-y-6">
      <nav aria-label="Index sections" className="flex flex-wrap gap-2">
        {SECTIONS.map(([id, name]) => <a key={id} href={`#idx-${id}`} className="rounded-full bg-white/70 px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-white dark:bg-slate-900/70 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800">{name}</a>)}
      </nav>

      <Card title="How to use the app" subtitle="Five pages; the shared assumptions at the top of three of them apply to all three" className="scroll-mt-24" >
        <div id="idx-use" className="grid gap-4 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300">
          <p><b className="text-slate-900 dark:text-slate-100">Overview.</b> The {int(meta.customers)} customers, how many left, the price of each service recovered from the bills, and who is at risk.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Pricing (Engine 1).</b> Sets a new price for each of the ten services. Press Run Engine 1; then Run sensitivity to see whether the answer depends on price sensitivity.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Retention (Engine 2).</b> Picks which at-risk customers to call and with which offer, within your budget, agent hours and cap per offer. Export the call list as a CSV for the call centre.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Coupling.</b> Runs Engine 2 at several budgets, then Engine 1 on the lower churn, to show how retention spending frees room to raise prices.</p>
          <p className="sm:col-span-2">Click any <span className="inline-grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ring-1 ring-slate-300 dark:ring-slate-600">?</span> next to a label to jump to its entry below. Every result is an <b className="text-slate-900 dark:text-slate-100">expected value under the settings on screen</b>, not a forecast.</p>
        </div>
      </Card>

      <Card title="Agent time and cost per customer" subtitle={`What one call takes and costs, by offer · costs at the average bill of ${cents(meta.meanBill)} a month`}>
        <div id="idx-agents" className="scroll-mt-24">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="Agent time and cost per offer">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">
                <th className="pb-2 font-medium">Offer</th><th className="pb-2 text-right font-medium">Agent time per call</th>
                <th className="pb-2 text-right font-medium">Cost if accepted</th><th className="pb-2 text-right font-medium">Expected cost per call</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {meta.offers.map((o) => (
                  <tr key={o.key}><td className="py-2 text-slate-800 dark:text-slate-200">{o.name}</td>
                    <td className="py-2 text-right tabular-nums">{o.hours} h <span className="text-slate-600 dark:text-slate-400">({Math.round(o.hours * 60)} min)</span></td>
                    <td className="py-2 text-right tabular-nums">{cents(o.costIfAccepted)}</td>
                    <td className="py-2 text-right font-medium tabular-nums text-slate-900 dark:text-slate-100">{cents(o.expectedCost)}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 space-y-2 text-sm text-slate-700 dark:text-slate-300">
            <li><b className="text-slate-900 dark:text-slate-100">Agent time is spent on every call</b>, whether or not the customer accepts; the money cost is paid only by those who accept, so the expected cost per call is the cost if accepted × the acceptance rate ({pct(d.acceptance)} by default).</li>
            <li><b className="text-slate-900 dark:text-slate-100">Where the costs come from:</b> a contract discount costs the revenue given up ({pct(d.discount1yr)} off for 12 months, {pct(d.discount2yr)} off for 24); a free service costs its unit cost for {d.freeMonths} months; the autopay switch costs a {money(d.autopayCredit)} credit; two-year + tech support adds a {money(d.comboPremium)} premium.</li>
            <li><b className="text-slate-900 dark:text-slate-100">The suggested campaign</b> (the defaults on Retention): {money(R.budget)}, {int(R.hours)} agent hours, at most {int(R.cap)} customers per offer. After a run, the Retention page shows the average expected cost and agent time per customer called.</li>
            <li><b className="text-slate-900 dark:text-slate-100">In the coupling sweep</b> each budget gets agent hours and a cap per offer in the same proportions: one agent hour per {money(c.dollarsPerHour)} and one offer slot per {cents(c.dollarsPerCapSlot)} of budget.</li>
          </ul>
        </div>
      </Card>

      <Card title="Terms" subtitle="In the order you meet them in the app">
        <div id="idx-terms" className="grid scroll-mt-24 gap-1 lg:grid-cols-2">
          <Term id="churn" name="Churn" where="Overview">A customer leaving. In this data a customer has churned if they left at some point in their recorded time as a customer. {meta.churnRatePct.toFixed(1)}% of customers did.</Term>
          <Term id="tenure" name="Tenure" where="Overview">How many months someone has been a customer. The churn model treats it as the time each customer was at risk of leaving.</Term>
          <Term id="price-recovery" name="Recovered price list" where="Overview">The bills are not itemised, so the price of each service is worked out from the bills of customers with different combinations of services (R² {meta.decompositionR2.toFixed(4)}: the prices explain the bills almost exactly).</Term>
          <Term id="hazard" name="Monthly churn risk (hazard)" where="Overview, Retention">The chance that a customer leaves in a given month, given their contract, services, payment method and how long they have been a customer.</Term>
          <Term id="candidate" name="At-risk customer (candidate)" where="Overview, Retention">A current customer (not one the data says has already left) whose monthly churn risk is at or above the at-risk threshold ({pct(d.threshold)} a month by default): {int(meta.candidates)} of the {int(meta.currentCustomers)} current customers at the default. The churn model itself learns from all {int(meta.customers)} customers, including those who left.</Term>
          <Term id="margin" name="Profit margin" where="Shared assumptions">The share of each bill that is profit. Costs are fixed per service at (1 − margin) × today's price, so raising a price raises profit by the full increase.</Term>
          <Term id="discount-rate" name="Discount rate" where="Shared assumptions">How much less a dollar of profit next month is worth than one today, per month. It turns a stream of monthly profit into one present value.</Term>
          <Term id="clv" name="Customer lifetime value (CLV)" where="Pricing, Retention">The present value of all the monthly profit a customer is expected to bring before they leave. Higher churn risk means a shorter expected lifetime and a lower CLV.</Term>
          <Term id="lifetime-profit" name="Lifetime profit" where="Pricing, Coupling">The sum of every customer's CLV: the quantity Engine 1 maximises.</Term>
          <Term id="eta" name="Price sensitivity (η)" where="Shared assumptions">How strongly a customer's churn risk rises when their bill rises. It cannot be measured from this data, because no price ever changed, so it is a scenario setting tested from 0.4 to 1.5.</Term>
          <Term id="price-bound" name="Price bound" where="Pricing">How far any single price may move from today's, up or down.</Term>
          <Term id="bill-shock" name="Bill-shock cap" where="Pricing">How far any customer's total monthly bill may move. It is checked for every combination of services that customers actually hold.</Term>
          <Term id="churn-ceiling" name="Churn ceiling" where="Pricing">The rule that average monthly churn risk may not rise above today's. It is what makes Engine 1 cut fibre: without it, every price simply rises to the bill-shock cap.</Term>
          <Term id="shadow-price" name="Value of 1% churn room" where="Pricing">How much more lifetime profit the best prices would make if the business accepted 1% more average churn. It prices the trade-off; it is not a recommendation.</Term>
          <Term id="sensitivity" name="Sensitivity check (pattern)" where="Pricing">Engine 1 re-solved at four price sensitivities. The pattern has one letter per service: U at the upper price bound, + or − moved up or down inside it.</Term>
          <Term id="budget" name="Retention budget" where="Retention">The money available for offers, counted as expected cost: what accepted offers will cost on average.</Term>
          <Term id="agent-hours" name="Agent hours" where="Retention">Total call-centre time available for the campaign. Each call takes the time listed in the table above.</Term>
          <Term id="cap" name="Cap per offer" where="Retention">The most customers who may receive the same offer, so the campaign is not all one offer.</Term>
          <Term id="acceptance" name="Acceptance rate" where="Retention">The share of called customers who say yes. It is not in the data; {pct(d.acceptance)} comes from published retention studies.</Term>
          <Term id="haircut" name="Contract-effect strength" where="Retention">How much of the churn reduction the model links to longer contracts is believed. Customers who chose long contracts were already less likely to leave, so part of the link is selection, not effect; ×0.5 keeps half of it.</Term>
          <Term id="value-preserved" name="Value preserved" where="Retention">The expected gain in lifetime value from the call list: for each customer, acceptance × (CLV with the offer − CLV today).</Term>
          <Term id="lp-bound" name="LP bound" where="Retention">The best value possible if customers could receive fractions of offers. No real call list can beat it, so it measures how close the actual list is.</Term>
          <Term id="gap" name="Optimality gap" where="Retention">How far the call list's value is below the LP bound. The solver stops at 0.1%; it usually does much better.</Term>
          <Term id="greedy" name="Greedy ranking" where="Retention">Sorting customers by a score and calling from the top until the budget, hours or caps run out. The best of three such rankings is compared with the optimiser's list.</Term>
          <Term id="time-limit" name="Solver time limit" where="Retention, Coupling">The longest the offer optimiser may search. If it stops there, the page says so: the list is the best found in that time, not proven within the gap.</Term>
          <Term id="robustness" name="Still called · same offer" where="Retention">From the robustness check: the share of the base list's customers called again under a weaker assumption, and the share of those who get the same offer.</Term>
          <Term id="coupling" name="Coupling" where="Coupling">Linking the two engines: retention calls lower some customers' churn, which leaves room under the churn ceiling to raise prices.</Term>
          <Term id="net-gain" name="Net gain" where="Coupling">Lifetime profit at the new prices and the lower churn, minus the retention spend, minus today's lifetime profit.</Term>
        </div>
      </Card>

      <Card title="Formulas" subtitle="i = a customer, j = an offer, B = monthly bill, h = monthly churn risk, m = margin, d = discount rate">
        <div id="idx-formulas" className="scroll-mt-24 space-y-4 text-sm text-slate-700 dark:text-slate-300">
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Customer lifetime value</p>
            <F>CLV<sub>i</sub> = π<sub>i</sub> / (d + h<sub>i</sub>),   π<sub>i</sub> = m × B<sub>i</sub></F>
            <p>Monthly profit π, discounted, for as long as the customer is expected to stay (profit arrives at the end of each month).</p></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">How churn risk responds to a new price list P (Engine 1)</p>
            <F>B<sub>i</sub>(P) = Σ<sub>services held</sub> P<sub>s</sub>,   h<sub>i</sub>(P) = h<sub>i</sub> × (B<sub>i</sub>(P) / B<sub>i</sub>)<sup>η</sup></F></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Engine 1: price optimiser</p>
            <F>maximise Σ<sub>i</sub> (B<sub>i</sub>(P) − C<sub>i</sub>) / (d + h<sub>i</sub>(P)),   C<sub>i</sub> = (1 − m) × today's B<sub>i</sub></F>
            <p>subject to: each price within the price bound; every service combination's bill within the bill-shock cap; fibre at least $10 above DSL; average h(P) ≤ today's average h (churn ceiling, when on).</p></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Engine 2: offer optimiser</p>
            <F>V<sub>ij</sub> = a × (CLV<sub>i</sub> with offer j − CLV<sub>i</sub> today),   cost<sub>ij</sub> = a × cost if accepted</F>
            <F>maximise Σ V<sub>ij</sub> x<sub>ij</sub>   with x<sub>ij</sub> ∈ {'{0, 1}'}: at most one offer per customer; Σ cost ≤ budget; Σ hours<sub>j</sub> ≤ agent hours; customers per offer ≤ cap</F>
            <p>a = acceptance rate. An offer lowers the customer's churn risk only for its term (12 or 24 months for contracts, {d.freeMonths} months for free services), then it returns to today's.</p></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Offer costs (if accepted)</p>
            <F>contract discount = rate × B × months,   free service = {d.freeMonths} × unit cost,   autopay = {money(d.autopayCredit)} credit</F></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Optimality gap</p><F>gap = (LP bound − value) / value</F></div>
          <div><p className="font-semibold text-slate-900 dark:text-slate-100">Coupling</p>
            <F>h<sub>i</sub>′ = π<sub>i</sub> / (CLV<sub>i</sub> + V<sub>i</sub>) − d   for each called customer</F>
            <F>net gain = lifetime profit(new prices, h′) − retention spend − today's lifetime profit</F>
            <p>The lower churn risk h′ is the constant monthly risk that would give the customer the value they have with the offer; Engine 1 is then re-solved with the churn ceiling held at today's level.</p></div>
        </div>
      </Card>

      <Card title="Methods" subtitle="How each number on the screens is computed">
        <div id="idx-methods" className="scroll-mt-24 grid gap-4 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300">
          <p><b className="text-slate-900 dark:text-slate-100">Service prices:</b> least-squares regression of each customer's bill on the services they hold; the coefficients are the prices.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Monthly churn risk:</b> a piecewise-exponential survival model, fitted as a Poisson regression on customer-months, with tenure bands 1-6, 7-12, 13-24, 25-48 and 49-72 months.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Engine 1:</b> SciPy SLSQP (sequential quadratic programming) from 8 starting points; the answer is kept only if the starts agree. Its Lagrange multiplier on the churn ceiling gives the value of 1% churn room.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Engine 2:</b> a binary integer program solved by SciPy's milp (HiGHS) to a 0.1% gap; its linear relaxation gives the LP bound; three greedy rankings are solved for comparison.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Sensitivity and robustness:</b> the same engines re-solved with one assumption changed and everything else as on screen; they run as background jobs you can cancel.</p>
          <p><b className="text-slate-900 dark:text-slate-100">Coupling:</b> Engine 2 at each budget, each called customer's churn risk lowered to h′, then Engine 1 re-solved.</p>
        </div>
      </Card>

      <Card title="Assumptions, limits and verification" subtitle="What every number rests on, and how it is checked">
        <div id="idx-limits" className="scroll-mt-24 grid gap-6 text-sm text-slate-700 lg:grid-cols-2 dark:text-slate-300">
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Assumptions</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>Churn means "left during the recorded tenure"; the dataset card says "last month", which the file contradicts.</li>
              <li>One price sensitivity for every customer; it is a setting, because no price ever changed in the data.</li>
              <li>Offer effects are what the churn model associates with each contract or service, not measured effects; no offer was ever made.</li>
              <li>Acceptance rate: not in the data; {pct(d.acceptance)} from published studies.</li>
              <li>Margin, discount rate, budget, hours and caps are manager inputs, not data.</li>
            </ul>
          </div>
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100">Never claimed</p>
            <ul className="mt-2 list-disc space-y-1.5 pl-5">
              <li>A measured price sensitivity, or "offer X cuts churn by Y%".</li>
              <li>"The campaign will save …": every value is expected, under the settings on screen.</li>
              <li>That the price answer comes from the shape of the profit curve: the churn ceiling produces it.</li>
              <li>That ranking customers by score matches the optimiser: it is several percent worse.</li>
            </ul>
            <p className="mt-4 font-semibold text-slate-900 dark:text-slate-100">Verification</p>
            <p className="mt-1">Every number above is re-derived from the raw file by automated checks (<code>npm run verify</code>, <code>npm run verify:coupling</code>).</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="emerald">{meta.verification.passed} passed</Badge><Badge tone="rose">{meta.verification.refuted} earlier claims refuted</Badge>
              <Badge tone="amber">{meta.verification.updated} earlier figure updated</Badge><Badge>{meta.verification.checks} total</Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}

export default function Index({ meta, status }) {
  return <MetaGate meta={meta} status={status}><Body meta={meta} /></MetaGate>
}

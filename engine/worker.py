"""Long-lived engine worker. Protocol: one JSON object per line on stdin -> one JSON object per line on stdout.
Request  {"id": str, "op": "meta"|"engine1"|"engine2"|"coupling", "params": {...}}
Reply    {"id": str, "ok": true, "result": {...}} | {"id": str, "ok": false, "error": str}
Progress {"id": str, "progress": {"done": int, "total": int, "row": {...}}}   (coupling only)
C-level solver output is diverted to stderr so it can never corrupt the protocol stream."""
import os, sys, json, time, traceback
PROTO = os.fdopen(os.dup(1), 'w', buffering=1)
os.dup2(2, 1); sys.stdout = sys.stderr
import warnings; warnings.filterwarnings('ignore')
import numpy as np, pandas as pd
from common import DF, A, SV, NAMES, P0, R2, Am, B0
from hazard import HazardModel
import engine1 as E1, engine2 as E2

T0 = time.time(); HM = HazardModel(); H = E2.counterfactuals(HM); STARTUP_S = time.time() - T0
OFFER_NAMES = {'1yr': 'One-year contract', '2yr': 'Two-year contract', 'tech': 'Free tech support', 'sec': 'Free online security',
               'auto': 'Autopay switch', '2yr+tech': 'Two-year + tech support'}

def send(obj): PROTO.write(json.dumps(obj, separators=(',', ':')) + '\n')
def num(p, k, default, lo, hi):
    v = float(p.get(k, default))
    if not (lo <= v <= hi): raise ValueError(f'{k}={v} outside [{lo}, {hi}]')
    return v

def op_meta(p):
    y = DF.y.values
    return dict(customers=int(len(DF)), churners=int(y.sum()), churnRatePct=round(100 * y.mean(), 2),
                meanTenure=round(float(DF.tenure.mean()), 2), decompositionR2=round(float(R2), 4), baskets=int(len(E1.Ub)),
                prices=[dict(key=s, name=NAMES[s], price=round(float(v), 2)) for s, v in zip(SV, P0)],
                hazard=dict(meanPct=round(100 * float(HM.h0.mean()), 2), medianPct=round(100 * float(np.median(HM.h0)), 2),
                            pool2=int((HM.h0 >= .02).sum()), pool3=int((HM.h0 >= .03).sum())),
                churnByContractPct={c: round(100 * float(v), 2) for c, v in DF.groupby('Contract').y.mean().items()},
                verification=dict(checks=76, passed=70, refuted=5, updated=1), startupSeconds=round(STARTUP_S, 2))

def op_engine1(p):
    eta = num(p, 'eta', 0.8, 0.05, 10); m = num(p, 'margin', 0.7, 0.01, 0.99); d = num(p, 'discount', 0.01, 0.0001, 0.2)
    pb = num(p, 'priceBound', 0.25, 0.01, 0.9); sh = num(p, 'billShock', 0.15, 0.01, 0.9); tier = num(p, 'tierGap', 10, 0, 100)
    ceiling = bool(p.get('ceiling', True)); starts = int(num(p, 'starts', 8, 1, 50))
    t = time.time(); r = E1.solve(HM.h0, eta, m=m, d=d, ceiling=ceiling, pb=pb, shock=sh, tier=tier, starts=starts)
    P = r['P']; U = E1.Ub @ P; active = np.where(np.isclose(U, (1 + sh) * E1.Bb0, rtol=1e-6) | np.isclose(U, (1 - sh) * E1.Bb0, rtol=1e-6))[0]
    rows = []
    for k, s in enumerate(SV):
        if np.isclose(P[k], (1 + pb) * P0[k], rtol=1e-6) or np.isclose(P[k], (1 - pb) * P0[k], rtol=1e-6): why = 'price bound'
        else:
            bs = [b for b in active if E1.Ub[b, k] == 1]
            if bs: why = 'bill-shock cap: ' + ' + '.join(NAMES[SV[q]] for q in np.where(E1.Ub[bs[0]] == 1)[0])
            elif ceiling and abs(r['Hratio'] - 1) < 1e-6: why = 'churn ceiling'
            else: why = 'unconstrained'
        rows.append(dict(key=s, name=NAMES[s], current=round(float(P0[k]), 2), optimal=round(float(P[k]), 2), changePct=round(100 * float(r['dP'][k]), 2), limitedBy=why))
    mult = getattr(r['res'], 'multipliers', None); shadow = None
    if ceiling and mult is not None and np.asarray(mult).size == len(E1.Ub) * 2 + 2:
        shadow = round(float(np.asarray(mult)[-1]) * r['base'] * 0.01 * HM.h0.mean(), 0)
    return dict(prices=rows, revenueChangePct=round(100 * r['rev'], 2), profitUpliftPct=round(100 * r['uplift'], 2),
                lifetimeProfitNow=round(r['base'], 0), lifetimeProfitNew=round(r['profit'], 0), meanHazardRatio=round(r['Hratio'], 4),
                binding=dict(billShockUpper=r['shock_up'], billShockLower=r['shock_dn'], priceBounds=r['pbound'], tierGapDollars=round(float(r['tier_gap']), 2),
                             ceilingBinding=bool(ceiling and abs(r['Hratio'] - 1) < 1e-6)),
                shadowPricePerPctHeadroom=shadow, starts=dict(requested=starts, succeeded=r['nsol'], spread=r['spread']),
                maxViolation=r['viol'], runtimeMs=round(1000 * (time.time() - t)))

def e2params(p):
    return dict(budget=num(p, 'budget', 30000, 0, 1e7), hours=num(p, 'hours', 500, 0, 1e5), cap=int(num(p, 'cap', 350, 0, 1e5)),
                accept=num(p, 'acceptance', 0.3, 0.01, 1), thr=num(p, 'threshold', 0.03, 0, 1), haircut=num(p, 'haircut', 1.0, 0, 1),
                m=num(p, 'margin', 0.7, 0.01, 0.99), d=num(p, 'discount', 0.01, 0.0001, 0.2), credit=num(p, 'credit', 25, 0, 1000),
                premium=num(p, 'premium', 10, 0, 1000),
                gap=num(p, 'mipGap', 1e-3, 1e-6, 0.1), tlimit=num(p, 'timeLimit', 30, 1, 600))

def op_engine2(p):
    q = e2params(p); t = time.time()
    R, npool = E2.build(H, m=q['m'], d=q['d'], thr=q['thr'], accept=q['accept'], haircut=q['haircut'], credit=q['credit'], premium=q['premium'])
    o = E2.solve(R, q['budget'], q['hours'], q['cap'], gap=q['gap'], tlimit=q['tlimit'])
    s = o['sel'].sort_values('V', ascending=False)
    calls = [dict(customerID=DF.customerID.iat[i], offer=E2.OFFERS[j], offerName=OFFER_NAMES[E2.OFFERS[j]],
                  monthlyHazardPct=round(100 * float(HM.h0[i]), 2), monthlyBill=round(float(DF.MonthlyCharges.iat[i]), 2),
                  contract=DF.Contract.iat[i], expectedCost=round(float(c), 2), expectedValue=round(float(v), 2), hours=float(h))
             for i, j, v, c, h in zip(s.i, s.j, s.V, s.cost, s.hrs)]
    vbo = s.groupby(s.j.map(dict(enumerate(E2.OFFERS)))).V.sum()
    return dict(value=round(o['ip'], 0), lpBound=round(o['lp'], 0), gapPct=round(100 * (o['lp'] - o['ip']) / o['ip'], 4) if o['ip'] else 0,
                greedyShortfallPct=round(100 * (o['ip'] - o['greedy']) / o['ip'], 2) if o['ip'] else 0,
                budgetUsedPct=round(100 * o['budget_used'], 1) if q['budget'] else 0, hoursUsedPct=round(100 * o['hours_used'], 1) if q['hours'] else 0,
                pool=npool, pairs=o['pairs'], called=len(calls), mix=o['mix'], valueByOffer={k: round(float(v), 0) for k, v in vbo.items()},
                feasible={k: bool(v) for k, v in o['feasible'].items()}, solverStatus=int(o['ip_status']), callList=calls, runtimeMs=round(1000 * (time.time() - t)))

def op_coupling(p, rid):
    budgets = [float(b) for b in p.get('budgets', [0, 15000, 30000, 60000, 90000])]
    eta = num(p, 'eta', 0.8, 0.05, 10); m = num(p, 'margin', 0.7, 0.01, 0.99); d = num(p, 'discount', 0.01, 0.0001, 0.2); hc = num(p, 'haircut', 1.0, 0, 1)
    C = (1 - m) * B0; h0 = HM.h0
    lp = lambda P, h: float(np.sum((Am @ P - C) / (d + h * ((Am @ P) / B0) ** eta)))
    base = lp(P0, h0); R, _ = E2.build(H, m=m, d=d, haircut=hc); rows = []; t = time.time()
    for k, b in enumerate(budgets):
        h1 = h0.copy(); spend = 0.0; direct = 0.0; o2 = None
        if b > 0:
            o2 = E2.solve(R, b, b / 60, int(b / 85.7), gap=1e-3, tlimit=30); s = o2['sel']; spend = float(s.cost.sum()); direct = float(s.V.sum())
            pi = m * B0[s.i.values]; h1[s.i.values] = pi / (pi / (d + h0[s.i.values]) + s.V.values) - d
        r = E1.solve(h1, eta, m=m, d=d, ceiling=True, Hbar=h0.mean(), starts=3)
        row = dict(budget=b, spend=round(spend, 0), offerValue=round(direct, 0), netGain=round(lp(r['P'], h1) - spend - base, 0),
                   fibrePct=round(100 * float(r['dP'][E1.iF]), 1), phonePct=round(100 * float(r['dP'][0]), 1), addonPct=round(100 * float(r['dP'][SV.index('Sec')]), 1),
                   mipGapPct=None if o2 is None else round(100 * (o2['lp'] - o2['ip']) / o2['ip'], 4))
        rows.append(row); send(dict(id=rid, progress=dict(done=k + 1, total=len(budgets), row=row)))
    return dict(baselineLifetimeProfit=round(base, 0), rows=rows, runtimeMs=round(1000 * (time.time() - t)))

send(dict(id='ready', ok=True, result=dict(startupSeconds=round(STARTUP_S, 2))))
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    rid = None
    try:
        req = json.loads(line); rid = req.get('id'); op = req.get('op'); p = req.get('params') or {}
        if op == 'meta': res = op_meta(p)
        elif op == 'engine1': res = op_engine1(p)
        elif op == 'engine2': res = op_engine2(p)
        elif op == 'coupling': res = op_coupling(p, rid)
        else: raise ValueError(f'unknown op {op!r}')
        send(dict(id=rid, ok=True, result=res))
    except Exception as e:
        send(dict(id=rid, ok=False, error=f'{type(e).__name__}: {e}'))
        traceback.print_exc(file=sys.stderr)

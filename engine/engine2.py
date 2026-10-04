"""Engine 2 (binary IP): assign at most one of six offers to each candidate customer.
max sum V_ij x_ij  s.t. sum_j x_ij <= 1 ; sum cost_ij x_ij <= budget ; sum hours_j x_ij <= hours ; sum_i x_ij <= cap_j.
Value = acceptance * [CLV with the offer's hazard path - CLV today]; CLV(h) = pi/(d+h) (end-of-month cash flows).
'corrected': effect lasts the offer term; discount cost = forgone revenue rho*B*L; money x acceptance; hours per contact.
'report'   : the PDF as written, evaluated with monthly hazards: permanent effect, discount cost rho*B*m*L, acceptance 1."""
import time, numpy as np, pandas as pd, scipy.sparse as sp
from scipy.optimize import milp, linprog, LinearConstraint, Bounds
from common import DF, Am, B0, P0, SV
iT, iS = SV.index('Tech'), SV.index('Sec')
OFFERS = ['1yr', '2yr', 'tech', 'sec', 'auto', '2yr+tech']
HOURS = {'1yr': 0.5, '2yr': 0.75, 'tech': 0.5, 'sec': 0.5, 'auto': 0.5, '2yr+tech': 1.0}
net = (DF.InternetService != 'No').values
m2m = (DF.Contract == 'Month-to-month').values
y1 = (DF.Contract == 'One year').values
manual = DF.PaymentMethod.isin(['Electronic check', 'Mailed check']).values
ELIG = {'1yr': m2m, '2yr': m2m | y1, 'tech': net & (Am[:, iT] == 0), 'sec': net & (Am[:, iS] == 0),
        'auto': manual, '2yr+tech': (m2m | y1) & net & (Am[:, iT] == 0)}

def counterfactuals(hm):
    return {'base': hm.h0, 'c1': hm.flip(c1=1.0, c2=0.0), 'c2': hm.flip(c1=0.0, c2=1.0), 'tech': hm.flip(Tech=1.0),
            'sec': hm.flip(Sec=1.0), 'auto': hm.flip(pay_cc=1.0, pay_bt=0.0, pay_mail=0.0),
            'c2tech': hm.flip(c1=0.0, c2=1.0, Tech=1.0)}

def clv_path(pi, d, path, hb):
    v = np.zeros_like(pi); g = np.ones_like(pi)
    for hh, L in path:
        q = (1 - hh) / (1 + d)
        if np.isinf(L): return v + g * pi / (1 + d) / (1 - q)
        v = v + g * pi / (1 + d) * (1 - q ** L) / (1 - q); g = g * q ** L
    return v + g * pi / (1 + d) / (1 - (1 - hb) / (1 + d))

def build(H, m=0.7, d=0.01, thr=0.03, style='corrected', accept=0.3, haircut=1.0, credit=25.0, premium=10.0,
          rho1=0.10, rho2=0.15, free=6, include_former=False):
    pi = m * B0; hb = H['base']
    hc = lambda k: hb * np.exp(np.log(H[k] / hb) * haircut)       # haircut on contract effects only
    if style == 'report':
        paths = {'1yr': [(hc('c1'), np.inf)], '2yr': [(hc('c2'), np.inf)], 'tech': [(H['tech'], np.inf)],
                 'sec': [(H['sec'], np.inf)], 'auto': [(H['auto'], np.inf)], '2yr+tech': [(hc('c2tech'), np.inf)]}
        disc = lambda rho, L: rho * B0 * m * L; acc = 1.0
    else:
        paths = {'1yr': [(hc('c1'), 12)], '2yr': [(hc('c2'), 24)], 'tech': [(H['tech'], free)], 'sec': [(H['sec'], free)],
                 'auto': [(H['auto'], np.inf)], '2yr+tech': [(hc('c2tech'), free), (hc('c2'), 24 - free)]}
        disc = lambda rho, L: rho * B0 * L; acc = accept
    give = lambda i: free * P0[i] * (1 - m) + 0 * B0
    cost = {'1yr': disc(rho1, 12), '2yr': disc(rho2, 24), 'tech': give(iT), 'sec': give(iS), 'auto': credit + 0 * B0,
            '2yr+tech': disc(rho2, 24) + give(iT) + premium}
    base = pi / (d + hb)
    # Candidates: monthly risk >= thr AND still a customer (Churn = No): a campaign can only call current customers.
    # The churn model is still fitted on everyone; include_former=True reproduces the earlier (pre-v1.3) call lists.
    pool = (hb >= thr) & (include_former | (DF.y.values == 0))
    out = []
    for j, k in enumerate(OFFERS):
        V = acc * (clv_path(pi, d, paths[k], hb) - base); c = acc * cost[k]
        keep = np.where(pool & ELIG[k] & (V > 0))[0]
        out.append(pd.DataFrame({'i': keep, 'j': j, 'V': V[keep], 'cost': c[keep], 'hrs': HOURS[k]}))
    return pd.concat(out, ignore_index=True), int(pool.sum())

def solve(R, budget, hours, cap, gap=1e-4, tlimit=120):
    n = len(R); cust = pd.factorize(R.i)[0]; nc = cust.max() + 1
    Ac = sp.csr_matrix((np.ones(n), (cust, np.arange(n))), shape=(nc, n))
    Ak = sp.csr_matrix((np.ones(n), (R.j.values, np.arange(n))), shape=(len(OFFERS), n))
    Ar = sp.csr_matrix(np.vstack([R.cost.values, R.hrs.values]))
    M = sp.vstack([Ac, Ar, Ak]).tocsr(); ub = np.concatenate([np.ones(nc), [budget, hours], np.full(len(OFFERS), cap)])
    t = time.time(); lp = linprog(-R.V.values, A_ub=M, b_ub=ub, bounds=(0, 1), method='highs'); tlp = time.time() - t
    t = time.time(); ip = milp(-R.V.values, constraints=LinearConstraint(M, -np.inf, ub), integrality=np.ones(n),
                                bounds=Bounds(0, 1), options={'mip_rel_gap': gap, 'time_limit': tlimit}); tip = time.time() - t
    if ip.x is None: raise ValueError(f'no call list found within the {tlimit:g} s time limit; allow more time (timeLimit)')
    x = np.round(ip.x); fr = (lp.x > 1e-7) & (lp.x < 1 - 1e-7)
    sel = R[x == 1]
    feas = dict(one_per_customer=int(sel.i.duplicated().sum()) == 0, budget=sel.cost.sum() <= budget + 1e-6,
                hours=sel.hrs.sum() <= hours + 1e-6, caps=bool((sel.j.value_counts() <= cap).all()))
    best = 0.0
    I, J, V, Cst, Hr = (R[c].to_numpy().tolist() for c in ('i', 'j', 'V', 'cost', 'hrs'))   # plain lists: fast to index in a loop
    for key in ['V/cost', 'V/resources', 'V']:
        s = {'V/cost': R.V / R.cost.clip(lower=1e-9), 'V/resources': R.V / (R.cost / budget + R.hrs / hours), 'V': R.V}[key]
        used = set(); b = h = 0.0; cu = [0] * len(OFFERS); val = 0.0
        for k in np.argsort(-s.values).tolist():
            i, j, v, c, hh = I[k], J[k], V[k], Cst[k], Hr[k]
            if i in used or b + c > budget or h + hh > hours or cu[j] >= cap: continue
            used.add(i); b += c; h += hh; cu[j] += 1; val += v
        best = max(best, val)
    return dict(pairs=n, customers=nc, lp=-lp.fun, ip=-ip.fun, ip_status=ip.status, mip_gap=getattr(ip, 'mip_gap', None),
                frac_vars=int(fr.sum()), frac_customers=len(set(cust[fr])), greedy=best, tlp=tlp, tip=tip,
                budget_used=sel.cost.sum() / budget, hours_used=sel.hrs.sum() / hours, feasible=feas,
                mix={OFFERS[j]: int(c) for j, c in sel.j.value_counts().items()}, sel=sel)

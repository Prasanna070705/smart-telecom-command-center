"""Re-derives every number in the blueprint from the raw CSV and prints PASS/FAIL against the stated claim.
Usage: python verify.py A B C D E F G H I J   (any subset). Results also go to results/<stage>.json."""
import sys, os, json, time, platform, importlib
import numpy as np, pandas as pd
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from common import DF, A, SV, P0, R2, RESID, Am, B0, CSV
os.makedirs('results', exist_ok=True)
LOG = []
def py(v):
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return float(v)
    if isinstance(v, (np.bool_,)): return bool(v)
    if isinstance(v, dict): return {str(k): py(x) for k, x in v.items()}
    if isinstance(v, (list, tuple, np.ndarray)): return [py(x) for x in v]
    return v
def chk(cid, claim, actual, expect=None, tol=None, ok=None):
    if ok is None:
        ok = True if expect is None else (abs(actual - expect) <= tol if tol is not None else actual == expect)
    LOG.append(dict(id=cid, claim=claim, actual=py(actual), expected=py(expect), status='PASS' if ok else 'FAIL'))
    print(f"[{'PASS' if ok else 'FAIL'}] {cid:4s} {claim}: actual={py(actual)}" + ('' if expect is None else f" | claimed={py(expect)}"))
y = DF.y.values

def stage_A():
    raw = pd.read_csv(CSV)
    chk('A1', 'rows x columns', list(raw.shape), [7043, 21])
    chk('A2', 'duplicate customerIDs', int(raw.customerID.duplicated().sum()), 0)
    blank = set(DF.index[DF.TC.isna()]); t0 = set(DF.index[DF.tenure == 0])
    chk('A3', 'blank TotalCharges rows are exactly the tenure-0 rows (count)', len(blank), 11, ok=(blank == t0 and len(blank) == 11))
    chk('A4', 'churners', int(y.sum()), 1869)
    chk('A5', 'churn rate % (2 dp)', round(100 * y.mean(), 2), 26.54)
    chk('A5b', 'deck slide 8 says 26.6%; correct 1-dp rounding', round(100 * y.mean(), 1), 26.6, ok=round(100 * y.mean(), 1) == 26.6)
    g = DF.gender.value_counts(normalize=True) * 100
    chk('A6', 'female % / male %', [round(g['Female'], 2), round(g['Male'], 2)], [49.52, 50.48])
    wc = DF.groupby('Contract').y.mean() * 100
    chk('A7', 'churn within M2M / 1yr / 2yr %', [round(wc['Month-to-month'], 2), round(wc['One year'], 2), round(wc['Two year'], 2)], [42.71, 11.27, 2.83])
    chk('A7b', 'deck slide 8 claims 75% of M2M customers left', round(wc['Month-to-month'], 1), 75.0, ok=False)
    sc = DF[DF.y == 1].Contract.value_counts(normalize=True) * 100
    chk('A8', 'share of churners on M2M %', round(sc['Month-to-month'], 2), 88.55)
    f = DF[DF.InternetService == 'Fiber optic'].copy(); f['q'] = pd.qcut(f.MonthlyCharges, 5, labels=False)
    fq = f.groupby('q').y.mean() * 100
    chk('A9', 'fibre: churn in lowest vs highest bill quintile %', [round(fq.iloc[0], 1), round(fq.iloc[-1], 1)], [56.6, 23.3])
    chk('A10', 'MonthlyCharges min / max', [DF.MonthlyCharges.min(), DF.MonthlyCharges.max()], [18.25, 118.75])
    r = DF.TC / (DF.MonthlyCharges * DF.tenure.replace(0, np.nan))
    chk('A11', 'TotalCharges/(MonthlyCharges x tenure): median, p10, p90', [round(r.median(), 3), round(r.quantile(.1), 3), round(r.quantile(.9), 3)], 1.0, ok=abs(r.median() - 1) < 0.005)
    s24 = (DF.tenure >= 24).mean() * 100; s1 = (DF.tenure <= 1).mean() * 100
    chk('A12', 'label check: % with tenure>=24 vs % implied if 26.54% were monthly; % in first month',
        [round(s24, 1), round(100 * (1 - y.mean()) ** 24, 3), round(s1, 1)], ok=s24 > 100 * (1 - y.mean()) ** 24 * 100)
    mt = DF[DF.y == 1].groupby('Contract').tenure.min()
    chk('A13', 'shortest tenure among churners: 1yr / 2yr', [int(mt['One year']), int(mt['Two year'])])
    chk('A14', 'mean tenure (months)', round(DF.tenure.mean(), 2), 32.37, tol=0.01)

def vif(X):
    out = {}
    for c in X.columns:
        o = X.drop(columns=c); out[c] = 1 / (1 - LinearRegression().fit(o, X[c]).score(o, X[c]))
    return pd.Series(out)

def stage_B():
    chk('B1', 'decomposition R^2 (gate >= 0.97)', round(R2, 4), 0.9988, ok=R2 >= 0.97)
    chk('B2', 'recovered prices $ (Phone,Multi,DSL,Fibre,Sec,Bk,Dev,Tech,TV,Mov)', [round(p, 2) for p in P0])
    chk('B2b', 'fibre price: report says ~$45', round(P0[SV.index('Fiber')], 2), 45.0, ok=False)
    chk('B3', 'all 10 prices positive', bool((P0 > 0).all()), True)
    v = vif(A); chk('B4', 'max VIF among the 10 flags (gate < 10)', round(v.max(), 2), ok=v.max() < 10)
    X2 = A.copy(); X2['MC'] = DF.MonthlyCharges
    chk('B5', 'VIF of MonthlyCharges given the flags (report says ~100)', round(vif(X2)['MC'], 0))
    chk('B6', 'bill variation left at a fixed bundle: residual SD $', round(RESID.std(), 2), 1.02, tol=0.005)
    chk('B7', 'corr(residual, tenure), corr(residual, churn)', [round(np.corrcoef(RESID, DF.tenure)[0, 1], 4), round(np.corrcoef(RESID, y)[0, 1], 4)],
        ok=abs(np.corrcoef(RESID, DF.tenure)[0, 1]) < 0.02 and abs(np.corrcoef(RESID, y)[0, 1]) < 0.02)
    chk('B8', 'max |residual| $', round(RESID.abs().max(), 2))
    nb = np.unique(Am, axis=0).shape[0]
    chk('B9', 'distinct service baskets (report says 1,400-1,800; structural max 386)', nb, 322)
    chk('B10', 'customers without phone: all on DSL (count)', int((DF.PhoneService == 'No').sum()),
        ok=set(DF[DF.PhoneService == 'No'].InternetService) == {'DSL'})
    one = A.sum(axis=1) == 1
    chk('B11', 'single-service customers: phone-only / DSL-only', [int((one & (A.Phone == 1)).sum()), int((one & (A.DSL == 1)).sum())], [1184, 80])

def stage_C():
    S = A.copy()
    base = pd.concat([pd.get_dummies(DF.Contract, drop_first=True).astype(float), DF[['tenure', 'MonthlyCharges']]], axis=1)
    mA = LogisticRegression(max_iter=5000, C=1e6).fit(base, y)
    BB = pd.concat([base, S], axis=1); mB = LogisticRegression(max_iter=5000, C=1e6).fit(BB, y)
    bA = mA.coef_[0][list(base.columns).index('MonthlyCharges')]; bB = mB.coef_[0][list(BB.columns).index('MonthlyCharges')]
    chk('C1', 'price coefficient flips sign with specification (without / with service flags)', [round(bA, 4), round(bB, 4)], ok=(bA > 0) and (bB < 0))
    a2 = base.copy(); a2['MonthlyCharges'] += 10; b2 = BB.copy(); b2['MonthlyCharges'] += 10
    chk('C2', '+$10 on every bill: predicted churn % under each spec',
        [round(100 * mA.predict_proba(base)[:, 1].mean(), 1), round(100 * mA.predict_proba(a2)[:, 1].mean(), 1), round(100 * mB.predict_proba(b2)[:, 1].mean(), 1)])

def stage_D():
    from hazard import HazardModel, person_period
    t = time.time(); hm = HazardModel(); secs = time.time() - t
    chk('D1', 'person-month file: events / exposure months', [int(hm.pp.event.sum()), int(hm.pp.exposure.sum())], [1869, 227990])
    Z = hm.Z.values; X = np.column_stack([np.ones(len(Z)), Z]); off = np.log(hm.pp.exposure.values); ev = hm.pp.event.values
    beta = np.zeros(X.shape[1]); beta[0] = np.log(ev.sum() / hm.pp.exposure.sum())
    for _ in range(100):
        mu = np.exp(X @ beta + off); step = np.linalg.solve(X.T @ (X * mu[:, None]), X.T @ (ev - mu)); beta += step
        if np.abs(step).max() < 1e-12: break
    diff = max(abs(beta[0] - hm.glm.intercept_), np.abs(beta[1:] - hm.glm.coef_).max())
    chk('D2', 'sklearn weighted Poisson == textbook offset GLM (max |coef diff|)', float(f'{diff:.2e}'), ok=diff < 1e-4)
    cal = hm.calibration(); cal['ratio'] = (cal.obs / cal.pred).round(2)
    m2m = cal.loc['Month-to-month']
    chk('D3', 'calibration obs/pred, M2M bands 0-4', m2m.ratio.tolist())
    chk('D3b', 'two-year: observed vs predicted churn events in first 24 months',
        [int(cal.loc['Two year'].obs.iloc[:3].sum()), round(cal.loc['Two year'].pred.iloc[:3].sum(), 1)])
    hr = np.exp(hm.coef[['c1', 'c2', 'Tech', 'Sec', 'pay_cc']])
    chk('D4', 'hazard ratios: 1yr, 2yr, tech support, online security, autopay(card)', [round(v, 3) for v in hr])
    chk('D5', 'current monthly hazard: mean / median', [round(hm.h0.mean(), 4), round(np.median(hm.h0), 4)])
    chk('D6', 'candidate pool at 2% / 3% monthly hazard', [int((hm.h0 >= .02).sum()), int((hm.h0 >= .03).sum())], [2345, 1629])
    chk('D7', 'hazard model fit time (s)', round(secs, 1))
    # the report's segment method, implemented as written: Contract x Internet x Payment, cells <50 merged into
    # their Contract x Internet parent, rates shrunk toward 26.54% with k pseudo-customers, h = 1-(1-p)^(1/mean tenure)
    d = DF.copy(); pg = d[d.tenure > 0].y.mean()
    keys = ['Contract', 'InternetService', 'PaymentMethod']
    cell = d[d.tenure > 0].groupby(keys).agg(n=('y', 'size'), p=('y', 'mean'), t=('tenure', 'mean'))
    par = d[d.tenure > 0].groupby(keys[:2]).agg(n=('y', 'size'), p=('y', 'mean'), t=('tenure', 'mean'))
    def seg_h(k):
        st = cell.copy()
        for idx in st.index[st.n < 50]: st.loc[idx, ['n', 'p', 't']] = par.loc[idx[:2], ['n', 'p', 't']].values
        st['h'] = 1 - (1 - (st.n * st.p + k * pg) / (st.n + k)) ** (1 / st.t)
        return d.join(st.h, on=keys).h.values
    res = {}
    for k in [0, 50, 200]:
        h = seg_h(k); res[k] = [round(np.mean(1 / h), 0), round(np.median(1 / h), 0), round(100 * np.mean(1 / h > 360), 1), int((h >= .03).sum()), int((h >= .02).sum())]
    chk('D8', "report's lifetime test ('mean implied lifetime ~32 mo'): [mean, median months, % >30 yrs, pool@3%, pool@2%] for shrinkage k=0/50/200",
        res, ok=all(v[0] > 100 for v in res.values()) and False)
    seg = d[(d.Contract == 'Month-to-month') & (d.InternetService == 'Fiber optic') & (d.PaymentMethod == 'Electronic check') & (d.tenure > 0)]
    p, tm = seg.y.mean(), seg.tenure.mean()
    chk('D9', "M2M+fibre+e-check: churn %, mean tenure, report-formula hazard % (report: 58 / 14 / 6.0)",
        [round(100 * p, 1), round(tm, 1), round(100 * (1 - (1 - p) ** (1 / tm)), 2)], ok=False)
    oe = d[d.tenure > 0].groupby(keys).apply(lambda g: g.y.sum() / g.tenure.sum(), include_groups=False)
    hoe = d.join(oe.rename('h'), on=keys).h.values
    chk('D10', 'pool @3% using events/exposure per segment', int((hoe >= .03).sum()))
    return hm

def stage_E(hm):
    from engine2 import clv_path
    pi = np.array([49.0]); d = 0.01; h = np.array([0.03])
    tt = np.arange(1, 6001); explicit = (pi[0] * (1 - h[0]) ** (tt - 1) / (1 + d) ** tt).sum()
    chk('E1', 'CLV closed form pi/(d+h) equals the explicit month-by-month sum (rel. error)', float(f'{abs(pi[0] / (d + h[0]) - explicit) / explicit:.1e}'), ok=abs(pi[0] / (d + h[0]) - explicit) / explicit < 1e-9)
    p1 = clv_path(pi, d, [(np.array([0.01]), 12)], h)[0]
    hh = np.r_[np.full(12, 0.01), np.full(5988, 0.03)]; S = np.r_[1, np.cumprod(1 - hh)[:-1]]
    ex2 = (pi[0] * S / (1 + d) ** tt).sum()
    chk('E2', 'temporary-effect CLV (12 months at 1%, then 3%) equals explicit sum (rel. error)', float(f'{abs(p1 - ex2) / ex2:.1e}'), ok=abs(p1 - ex2) / ex2 < 1e-9)
    dh = 0.02; exact = pi[0] / (d + h[0] - dh) - pi[0] / (d + h[0]); naive = pi[0] / (d + h[0]) * dh
    chk('E3', 'CLV x delta-h understates the exact value by a factor of', round(exact / naive, 1))
    # literal report: delta-p from a logistic model (cumulative scale) inside a monthly CLV denominator
    tb = pd.cut(DF.tenure, [-1, 12, 24, 48, 72], labels=['t0_12', 't12_24', 't24_48', 't48_72'])
    X = pd.concat([pd.get_dummies(DF.Contract).drop(columns='Month-to-month'), pd.get_dummies(DF.PaymentMethod).drop(columns='Electronic check'),
                   pd.get_dummies(tb).drop(columns='t0_12'), A, DF[['SeniorCitizen']], (DF[['Partner', 'Dependents']] == 'Yes'), (DF[['gender']] == 'Male')], axis=1).astype(float)
    lg = make_pipeline(StandardScaler(), LogisticRegression(max_iter=5000, C=1e6)).fit(X, y)
    m2m = (DF.Contract == 'Month-to-month').values
    Xc = X.copy(); Xc.loc[m2m, 'One year'] = 0; Xc.loc[m2m, 'Two year'] = 1
    dp = lg.predict_proba(X)[:, 1] - lg.predict_proba(Xc)[:, 1]
    mo = hm.h0
    neg = np.mean((d + mo - dp)[m2m] <= 0) * 100
    chk('E4', 'report formula with logistic delta-p in a monthly denominator: % of M2M two-year pairs with zero/negative denominator; mean delta-p',
        [round(neg, 1), round(dp[m2m].mean(), 3)], ok=neg > 50)
    pc = lg.predict_proba(X)[:, 1]
    chk('E5', 'reading p as cumulative everywhere: implied mean lifetime 1/(d+p) in months (observed mean tenure 32.4)', round(np.mean(1 / (d + pc)), 1))
    chk('E6', 'two-year discount cost, $70 bill, 15% x 24 months, m=0.7: report formula vs forgone revenue',
        [round(0.15 * 70 * 0.7 * 24, 0), round(0.15 * 70 * 24, 0)])

def stage_F(hm):
    import engine1 as E1
    h0 = hm.h0; out = {}
    corner = []
    for m in [0.3, 0.7]:
        for eta in [0.4, 0.8, 1.2, 1.5]:
            r = E1.solve(h0, eta, m=m, ceiling=False, starts=3); corner.append(np.abs(r['dP'] - 0.15).max())
    chk('F1', 'no churn ceiling: every price at +15% for all 8 (eta, m) cases (max deviation)', float(f'{max(corner):.1e}'), ok=max(corner) < 1e-5)
    pats = []; fib = []; ups = []; revs = []; times = []; viols = []; spreads = []
    for m in [0.3, 0.7]:
        for eta in [0.4, 0.8, 1.2, 1.5]:
            r = E1.solve(h0, eta, m=m, ceiling=True, starts=8)
            pats.append(r['dP']); fib.append(100 * r['dP'][E1.iF]); ups.append(100 * r['uplift']); revs.append(100 * r['rev'])
            times.append(r['secs']); viols.append(r['viol']); spreads.append(r['spread'])
            if m == 0.7 and eta == 0.8: ref = r
    allp = np.array([p for p in pats])
    cat = lambda dp: tuple('U' if abs(v - 0.25) < 1e-6 else ('L' if abs(v + 0.25) < 1e-6 else ('+' if v > 0.005 else ('-' if v < -0.005 else '0'))) for v in dp)
    chk('F2', 'with ceiling: same pattern in all 8 cases (U=at +25% bound, +/- = interior up/down, 0 = within 0.5%)', sorted(set(''.join(cat(p)) for p in allp)), ok=len(set(cat(p) for p in allp)) == 1)
    chk('F2b', 'with ceiling: range across the 8 cases of each price change %', {s_: [round(100 * allp[:, k].min(), 1), round(100 * allp[:, k].max(), 1)] for k, s_ in enumerate(SV)})
    chk('F3', 'with ceiling (eta=0.8, m=0.7): % change by service', {s: round(100 * v, 1) for s, v in zip(SV, ref['dP'])})
    chk('F4', 'fibre change range %, profit uplift range % (m=0.3..0.7), revenue range %',
        [round(min(fib), 1), round(max(fib), 1), round(min(ups), 1), round(max(ups), 1), round(min(revs), 2), round(max(revs), 2)])
    chk('F5', 'binding at eta=0.8,m=0.7: bill-shock upper / lower, price bounds, tier gap $, mean hazard ratio',
        [ref['shock_up'], ref['shock_dn'], ref['pbound'], round(ref['tier_gap'], 2), round(ref['Hratio'], 4)])
    chk('F6', 'multi-start agreement: max spread across starts / successful starts', [float(f'{max(spreads):.1e}'), ref['nsol']], ok=max(spreads) < 1e-4)
    chk('F7', 'max constraint violation at the reported optimum', float(f'{max(viols):.1e}'), ok=max(viols) < 1e-6)
    chk('F8', 'seconds per solve (8 starts): min / max', [round(min(times), 1), round(max(times), 1)])
    th = []
    for eta in [1.5, 2.0, 3.0, 5.0]:
        r = E1.solve(h0, eta, m=0.7, ceiling=False, starts=3); th.append([eta, round(100 * r['dP'].mean(), 1), r['shock_up']])
    chk('F9', 'no ceiling, m=0.7: interior optimum appears only at high eta [eta, mean price change %, baskets at +15% cap]', th)
    res = ref['res']; mult = getattr(res, 'multipliers', None)
    lam = None
    if mult is not None:
        mult = np.asarray(mult).ravel(); lam = float(mult[-1]) if mult.size >= 646 else None
    Hbar = h0.mean(); r2 = E1.solve(h0, 0.8, m=0.7, ceiling=True, Hbar=1.01 * Hbar, starts=3)
    fd = r2['profit'] - ref['profit']
    chk('F10', "SLSQP returns 'multipliers' (count) and ceiling shadow price: FD value of +1% headroom $ vs multiplier estimate $",
        [None if mult is None else int(mult.size), round(fd, 0), None if lam is None else round(lam * ref['base'] * 0.01 * Hbar, 0)],
        ok=(mult is not None) and (lam is not None) and abs(lam * ref['base'] * 0.01 * Hbar - fd) / fd < 0.05)
    out['ref'] = py(ref['dP']); return ref

def stage_G(hm):
    import engine2 as E2
    H = E2.counterfactuals(hm)
    R, npool = E2.build(H); o = E2.solve(R, 30000, 500, 350)
    chk('G1', 'candidates at 3% / eligible customer-offer pairs', [npool, o['pairs']])
    chk('G2', 'IP value $, LP bound $, LP-IP gap %, HiGHS status, reported MIP gap',
        [round(o['ip'], 0), round(o['lp'], 0), round(100 * (o['lp'] - o['ip']) / o['ip'], 4), o['ip_status'], o['mip_gap']])
    chk('G3', 'LP fractional customers <= 8 and variables <= 16 (theory)', [o['frac_customers'], o['frac_vars']], ok=o['frac_customers'] <= 8 and o['frac_vars'] <= 16)
    chk('G4', 'best of 3 greedy rankings falls short of the IP by %', round(100 * (o['ip'] - o['greedy']) / o['ip'], 2), ok=o['ip'] > o['greedy'])
    chk('G5', 'IP solution feasible (one offer each, budget, hours, caps)', o['feasible'], ok=all(o['feasible'].values()))
    chk('G6', 'budget used %, hours used %, customers called, offer mix', [round(100 * o['budget_used'], 1), round(100 * o['hours_used'], 1), len(o['sel']), o['mix']])
    chk('G7', 'solve seconds: LP / IP', [round(o['tlp'], 2), round(o['tip'], 2)])
    base = o['sel']; b = set(base.i)
    Rr, _ = E2.build(H, style='report'); orp = E2.solve(Rr, 30000, 500, 350)
    rv = R.set_index(['i', 'j']).V.reindex(list(zip(orp['sel'].i, orp['sel'].j))).fillna(0).sum()
    a = set(orp['sel'].i); same = pd.merge(orp['sel'][['i', 'j']], base[['i', 'j']], on='i')
    chk('G8', "report formulas: claimed value $, its list re-valued correctly $ (% of corrected optimum), Jaccard, same-offer %, mix",
        [round(orp['ip'], 0), round(rv, 0), round(100 * rv / o['ip'], 1), round(len(a & b) / len(a | b), 2), round(100 * (same.j_x == same.j_y).mean(), 0), orp['mix']])
    sens = []
    for hc in [0.5, 0.25]:
        R2_, _ = E2.build(H, haircut=hc); s = E2.solve(R2_, 30000, 500, 350); a = set(s['sel'].i)
        same = pd.merge(s['sel'][['i', 'j']], base[['i', 'j']], on='i')
        sens.append([hc, round(s['ip'], 0), round(100 * len(a & b) / len(b), 0), round(100 * (same.j_x == same.j_y).mean(), 0), round(100 * (s['ip'] - s['greedy']) / s['ip'], 2), s['mix']])
    chk('G9', 'contract-effect haircut [factor, value $, % of customers kept, % same offer, greedy gap %, mix]', sens)
    acc = []
    for ac in [0.15, 0.5]:
        R3, _ = E2.build(H, accept=ac); s = E2.solve(R3, 30000, 500, 350); a = set(s['sel'].i)
        acc.append([ac, round(s['ip'], 0), round(100 * len(a & b) / len(b), 0), s['mix']])
    chk('G10', 'acceptance rate [rate, value $, % of customers kept, mix]', acc)
    return o

def stage_H(hm):
    import engine1 as E1, engine2 as E2
    m, d, eta = 0.7, 0.01, 0.8; C = (1 - m) * B0; h0 = hm.h0; H = E2.counterfactuals(hm)
    lp = lambda P, h: np.sum((Am @ P - C) / (d + h * ((Am @ P) / B0) ** eta))
    base = lp(P0, h0); rows = []
    for hc in [1.0, 0.5]:
        R, _ = E2.build(H, haircut=hc)
        for B2 in ([0, 15000, 30000, 60000, 90000] if hc == 1.0 else [15000, 30000]):
            h1 = h0.copy(); spend = 0.0; direct = 0.0
            if B2:
                s = E2.solve(R, B2, B2 / 60, int(B2 / 85.7), gap=1e-3, tlimit=30)['sel']; spend = s.cost.sum(); direct = s.V.sum()   # the API's settings
                pi = m * B0[s.i.values]; h1[s.i.values] = pi / (pi / (d + h0[s.i.values]) + s.V.values) - d
            r = E1.solve(h1, eta, m=m, d=d, ceiling=True, Hbar=h0.mean(), starts=3)
            rows.append([hc, B2, round(spend, 0), round(direct, 0), round((lp(r['P'], h1) - spend - base) / 1e6, 3), round(100 * r['dP'][E1.iF], 1), round(100 * r['dP'][0], 1), round(100 * r['dP'][SV.index('Sec')], 1)])
    chk('H1', 'baseline lifetime profit $M (m=0.7, d=1%)', round(base / 1e6, 2))
    # acceptance (plan.md): net gain $M at haircut 1, each within 1%; the $15k row is a range because near-optimal lists differ
    ref = {0: (1.29, 1.29), 15000: (2.32, 2.34), 30000: (3.15, 3.15), 60000: (3.28, 3.28), 90000: (3.30, 3.30)}
    ok = all(ref[r[1]][0] * 0.99 <= r[4] <= ref[r[1]][1] * 1.01 for r in rows if r[0] == 1.0) and sum(r[0] == 1.0 for r in rows) == len(ref)
    chk('H2', 'coupling sweep, gap 0.1% [haircut, retention budget $, spend $, retention value $, net gain $M, fibre %, phone %, add-ons %]', rows,
        expect={k: v[0] if v[0] == v[1] else list(v) for k, v in ref.items()}, ok=ok)
    nF = int(A.Fiber.sum()); chk('H3', 'fibre customers and monthly revenue of an 18.1% fibre cut $', [nF, round(nF * P0[SV.index('Fiber')] * 0.181, 0)])

def stage_I(hm):
    from hazard import HazardModel
    import engine1 as E1, engine2 as E2
    hi = HazardModel(interactions=True, alpha=1e-6)
    cal = hi.calibration(); nz = cal[cal.obs > 0]
    chk('I1', 'interaction model: worst obs/pred in cells with events; predicted events in zero-event cells',
        [round(float((nz.obs / nz.pred).max()), 2), round(float((nz.obs / nz.pred).min()), 2), round(float(cal[cal.obs == 0].pred.sum()), 2)])
    chk('I2', 'interaction model: mean hazard, pool @3%', [round(hi.h0.mean(), 4), int((hi.h0 >= .03).sum())])
    r = E1.solve(hi.h0, 0.8, m=0.7, ceiling=True, starts=6)
    chk('I3', 'Engine 1 with interaction hazards (eta=0.8, m=0.7): % change by service', {s: round(100 * v, 1) for s, v in zip(SV, r['dP'])})
    Hm = E2.counterfactuals(hm); Hi = E2.counterfactuals(hi)
    R, _ = E2.build(Hm); a = E2.solve(R, 30000, 500, 350)
    Ri, npi = E2.build(Hi); b = E2.solve(Ri, 30000, 500, 350)
    sa, sb = set(a['sel'].i), set(b['sel'].i)
    chk('I4', 'Engine 2 with interaction hazards: value $, mix, % of main-model customers still called',
        [round(b['ip'], 0), b['mix'], round(100 * len(sa & sb) / len(sa), 0)])

def stage_J():
    v = {'python': platform.python_version()}
    for mod in ['numpy', 'pandas', 'scipy', 'sklearn', 'pyarrow', 'pulp', 'statsmodels', 'streamlit', 'plotly']:
        try: v[mod] = importlib.import_module(mod).__version__
        except Exception: v[mod] = 'not installed here'
    chk('J1', 'environment used for verification', v)

if __name__ == '__main__':
    st = sys.argv[1:] or list('ABCDEFGHIJ'); T = time.time(); hm = None
    for s in st:
        t = time.time(); print(f'=== stage {s} ===', flush=True)
        if s in 'ABCJ': globals()[f'stage_{s}']()
        else:
            if hm is None:
                from hazard import HazardModel; hm = HazardModel()
            if s == 'D': hm = stage_D()
            else: globals()[f'stage_{s}'](hm)
        print(f'--- stage {s}: {time.time() - t:.1f}s', flush=True)
    json.dump(LOG, open(f"results/{''.join(st)}.json", 'w'), indent=1)
    print(f'TOTAL {time.time() - T:.1f}s | PASS {sum(r["status"] == "PASS" for r in LOG)} | FAIL {sum(r["status"] == "FAIL" for r in LOG)}')

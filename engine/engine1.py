"""Engine 1 (NLP): choose 10 service prices P.
max  sum_i (B_i(P) - C_i) / (d + h_i(P)),  B_i(P) = a_i.P,  C_i = (1-m) * B_i(P0)  (unit costs fixed at today's level)
h_i(P) = h0_i * (B_i(P)/B_i(P0))**eta      (eta = scenario input; not estimable from this data)
s.t. (1-pb)P0 <= P <= (1+pb)P0 ; (1-s)B_b0 <= a_b.P <= (1+s)B_b0 for each of the 322 baskets ;
     P_fibre - P_DSL >= tier ; mean_i h_i(P) <= Hbar (churn ceiling, default = today's mean hazard)."""
import time, numpy as np
from scipy.optimize import minimize
from common import Am, B0, P0, SV
Ub = np.unique(Am, axis=0); Bb0 = Ub @ P0
iF, iD = SV.index('Fiber'), SV.index('DSL')

def solve(h, eta, m=0.7, d=0.01, ceiling=True, Hbar=None, pb=0.25, shock=0.15, tier=10.0, starts=8, seed=0):
    t0 = time.time()
    C = (1 - m) * B0
    Hbar = h.mean() if Hbar is None else Hbar
    base = np.sum((B0 - C) / (d + h))
    hz = lambda P: h * ((Am @ P) / B0) ** eta
    f = lambda P: -np.sum((Am @ P - C) / (d + hz(P))) / base
    def g(P):
        B = Am @ P; H = hz(P); den = d + H
        return -(Am.T @ (1 / den - (B - C) * eta * H / B / den ** 2)) / base
    cons = [{'type': 'ineq', 'fun': lambda P: (1 + shock) * Bb0 - Ub @ P, 'jac': lambda P: -Ub},
            {'type': 'ineq', 'fun': lambda P: Ub @ P - (1 - shock) * Bb0, 'jac': lambda P: Ub},
            {'type': 'ineq', 'fun': lambda P: np.array([P[iF] - P[iD] - tier]), 'jac': lambda P: np.eye(10)[iF] - np.eye(10)[iD]}]
    if ceiling:
        cons.append({'type': 'ineq', 'fun': lambda P: np.array([Hbar - hz(P).mean()]),
                     'jac': lambda P: -(Am.T @ (eta * hz(P) / (Am @ P))) / len(h)})
    bnds = [((1 - pb) * p, (1 + pb) * p) for p in P0]
    rng = np.random.default_rng(seed); sols = []; best = None
    for s in range(starts):
        x0 = P0 if s == 0 else P0 * rng.uniform(0.9, 1.1, 10)
        r = minimize(f, x0, jac=g, bounds=bnds, constraints=cons, method='SLSQP', options={'maxiter': 1000, 'ftol': 1e-12})
        if r.success:
            sols.append(r.x)
            if best is None or r.fun < best.fun: best = r
    P = best.x; B = Am @ P; U = Ub @ P
    viol = max(np.max(U - (1 + shock) * Bb0), np.max((1 - shock) * Bb0 - U), tier - (P[iF] - P[iD]),
               (hz(P).mean() - Hbar) if ceiling else -1, np.max(P - (1 + pb) * P0), np.max((1 - pb) * P0 - P))
    return dict(P=P, dP=P / P0 - 1, base=base, profit=-best.fun * base, uplift=-best.fun - 1,
                rev=B.sum() / B0.sum() - 1, Hratio=hz(P).mean() / Hbar,
                shock_up=int(np.sum(np.isclose(U, (1 + shock) * Bb0, rtol=1e-6))),
                shock_dn=int(np.sum(np.isclose(U, (1 - shock) * Bb0, rtol=1e-6))),
                pbound=int(np.sum(np.isclose(P, (1 + pb) * P0, rtol=1e-6) | np.isclose(P, (1 - pb) * P0, rtol=1e-6))),
                tier_gap=P[iF] - P[iD], spread=float(np.max(np.ptp(np.array(sols) / P0, axis=0))) if len(sols) > 1 else 0.0,
                nsol=len(sols), starts=starts, viol=float(viol), res=best, secs=time.time() - t0)

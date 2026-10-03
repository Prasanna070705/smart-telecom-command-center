"""Stage 2: monthly churn hazard = piecewise-exponential model (Poisson GLM on person-month exposure).
Each customer's history is split into tenure bands; a churn is an event in the band where tenure ends.
Output: current monthly hazard per customer; counterfactual hazards by flipping covariates."""
import numpy as np, pandas as pd
from sklearn.linear_model import PoissonRegressor
from common import DF, A, SV
BANDS = [0, 6, 12, 24, 48, 72]
NB = len(BANDS) - 1

def band_of(t):
    t = np.maximum(np.asarray(t), 1)
    return np.clip(np.searchsorted(BANDS, t, side='left') - 1, 0, NB - 1)

def base_covariates(df=DF, a=A):
    X = pd.DataFrame(index=df.index)
    X['c1'] = (df.Contract == 'One year').astype(float)
    X['c2'] = (df.Contract == 'Two year').astype(float)
    X['pay_cc'] = (df.PaymentMethod == 'Credit card (automatic)').astype(float)
    X['pay_bt'] = (df.PaymentMethod == 'Bank transfer (automatic)').astype(float)
    X['pay_mail'] = (df.PaymentMethod == 'Mailed check').astype(float)
    for c in SV: X[c] = a[c].values
    X['paperless'] = (df.PaperlessBilling == 'Yes').astype(float)
    X['senior'] = df.SeniorCitizen.astype(float)
    X['partner'] = (df.Partner == 'Yes').astype(float)
    X['dep'] = (df.Dependents == 'Yes').astype(float)
    return X

def features(Xb, band, interactions):
    Z = Xb.reset_index(drop=True).copy()
    for k in range(1, NB): Z[f'band{k}'] = (band == k).astype(float)
    if interactions:
        for k in range(1, NB):
            Z[f'c1_b{k}'] = Z['c1'] * Z[f'band{k}']
            Z[f'c2_b{k}'] = Z['c2'] * Z[f'band{k}']
    return Z

def person_period(df=DF):
    rows = []
    for i, (t, yv) in enumerate(zip(df.tenure.values, df.y.values)):
        if t == 0: continue
        for b in range(NB):
            lo, hi = BANDS[b], BANDS[b + 1]
            if t <= lo: break
            rows.append((i, b, min(t, hi) - lo, int(yv == 1 and lo < t <= hi)))
    return pd.DataFrame(rows, columns=['i', 'band', 'exposure', 'event'])

class HazardModel:
    def __init__(self, interactions=False, alpha=0.0):
        self.inter = interactions
        self.Xb = base_covariates()
        self.pp = person_period()
        self.Z = features(self.Xb.iloc[self.pp.i.values], self.pp.band.values, interactions)
        self.cols = list(self.Z.columns)
        self.glm = PoissonRegressor(alpha=alpha, solver='newton-cholesky', max_iter=1000, tol=1e-12).fit(
            self.Z, self.pp.event / self.pp.exposure, sample_weight=self.pp.exposure)
        self.h0 = self.rate(self.Xb, DF.tenure.values)
    def rate(self, Xb, tenure):
        Z = features(Xb, band_of(tenure), self.inter)
        return self.glm.predict(Z[self.cols])
    def flip(self, **kw):
        Xc = self.Xb.copy()
        for k, v in kw.items(): Xc[k] = v
        return self.rate(Xc, DF.tenure.values)
    @property
    def coef(self): return pd.Series(self.glm.coef_, index=self.cols)
    def calibration(self):
        mu = self.glm.predict(self.Z) * self.pp.exposure.values
        t = pd.DataFrame({'contract': DF.Contract.values[self.pp.i.values], 'band': self.pp.band.values,
                          'obs': self.pp.event.values, 'pred': mu, 'expo': self.pp.exposure.values})
        return t.groupby(['contract', 'band']).sum()

"""Stage 0-1: load, clean, service grid, price recovery. Every other module imports from here."""
import os, numpy as np, pandas as pd
from sklearn.linear_model import LinearRegression
HERE = os.path.dirname(os.path.abspath(__file__))
CSV = os.environ.get('TELCO_CSV', os.path.join(HERE, 'WA_Fn-UseC_-Telco-Customer-Churn.csv'))
SV = ['Phone', 'Multi', 'DSL', 'Fiber', 'Sec', 'Bk', 'Dev', 'Tech', 'TV', 'Mov']
NAMES = {'Phone': 'Phone line', 'Multi': 'Multiple lines', 'DSL': 'DSL internet', 'Fiber': 'Fibre internet',
         'Sec': 'Online security', 'Bk': 'Online backup', 'Dev': 'Device protection', 'Tech': 'Tech support',
         'TV': 'Streaming TV', 'Mov': 'Streaming movies'}

def load():
    df = pd.read_csv(CSV)
    df['TC'] = pd.to_numeric(df['TotalCharges'], errors='coerce')   # 11 blanks -> NaN (all tenure 0)
    df['y'] = (df['Churn'] == 'Yes').astype(int)
    return df

def service_grid(df):
    # third levels ('No internet service', 'No phone service') collapse to 0 by construction
    return pd.DataFrame({
        'Phone': df.PhoneService == 'Yes', 'Multi': df.MultipleLines == 'Yes',
        'DSL': df.InternetService == 'DSL', 'Fiber': df.InternetService == 'Fiber optic',
        'Sec': df.OnlineSecurity == 'Yes', 'Bk': df.OnlineBackup == 'Yes', 'Dev': df.DeviceProtection == 'Yes',
        'Tech': df.TechSupport == 'Yes', 'TV': df.StreamingTV == 'Yes', 'Mov': df.StreamingMovies == 'Yes'}).astype(float)

DF = load()
A = service_grid(DF)
_lr = LinearRegression().fit(A, DF.MonthlyCharges)
P0 = _lr.coef_                      # recovered service prices
INTERCEPT = _lr.intercept_
R2 = _lr.score(A, DF.MonthlyCharges)
RESID = DF.MonthlyCharges - _lr.predict(A)
Am = A.values
B0 = Am @ P0                        # model bill at current prices (intercept ~ -0.1 ignored)

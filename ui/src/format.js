const MINUS = '−'
export const money = (v) => {
  if (v == null) return '—'
  const sign = v < 0 ? MINUS : ''
  const a = Math.abs(v)
  return a >= 1e6 ? `${sign}$${(a / 1e6).toFixed(2)}M` : `${sign}$${Math.round(a).toLocaleString('en-US')}`
}
export const pct = (v, digits = 1) => (v == null ? '—' : `${v > 0 ? '+' : v < 0 ? MINUS : ''}${Math.abs(v).toFixed(digits)}%`)
export const int = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'))

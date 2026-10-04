async function call(path, options = {}) {
  const res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || `Request failed (${res.status})`)
  return body
}
const post = (path, data) => call(path, { method: 'POST', body: JSON.stringify(data) })

export const api = {
  health: () => call('/api/health'),
  meta: () => call('/api/meta'),
  engine1: (params) => post('/api/engine1', params),
  sensitivity: (params) => post('/api/engine1/sensitivity', params),
  engine2: (params) => post('/api/engine2', params),
  startCoupling: (params) => post('/api/jobs/coupling', params),
  job: (id) => call(`/api/jobs/${id}`),
}

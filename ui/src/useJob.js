import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Starts a background job, polls it once a second until it stops running, and can cancel it.
// - A dropped poll (server busy or waking) is retried for up to RECONNECT_MS before giving up.
// - "no such job" means the server restarted and lost the run: status 'lost', so the page can offer to start again.
// - The server may hand back an identical run that is already going or finished: `reused` is then true.
const RECONNECT_MS = 120000

export function useJob() {
  const [job, setJob] = useState(null); const [error, setError] = useState(null); const [reused, setReused] = useState(false)
  const [startedAt, setStartedAt] = useState(null); const timer = useRef(null); const failingSince = useRef(null)
  useEffect(() => () => clearInterval(timer.current), [])
  const start = async (startFn, total) => {
    setError(null); setReused(false); clearInterval(timer.current); failingSince.current = null
    try {
      const { jobId, reused: r } = await startFn()
      setReused(!!r); setStartedAt(Date.now())
      setJob({ id: jobId, status: 'running', progress: { done: 0, total, rows: [] } })
      timer.current = setInterval(async () => {
        try {
          const j = await api.job(jobId); failingSince.current = null; setError(null); setJob(j)
          if (j.status !== 'running') clearInterval(timer.current)
        } catch (e) {
          if (/no such job/.test(e.message)) {
            clearInterval(timer.current); setJob((o) => o && { ...o, status: 'lost' })
            setError('The server restarted and this run was lost. Start it again.')
          } else {
            failingSince.current ??= Date.now()
            if (Date.now() - failingSince.current > RECONNECT_MS) { clearInterval(timer.current); setError(`Lost contact with the server: ${e.message}`) }
            else setError('Reconnecting to the server…')
          }
        }
      }, 1000)
    } catch (e) { setError(e.message) }
  }
  const cancel = async () => {
    if (!job?.id) return
    clearInterval(timer.current)
    try { setJob(await api.cancelJob(job.id)) } catch (e) { setError(e.message) }
  }
  return { job, error, start, cancel, reused, startedAt, running: job?.status === 'running' }
}

// Seconds since `since` while `active`, re-rendering once a second.
export function useElapsed(since, active) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => { if (!active) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t) }, [active])
  return since && active ? Math.max(0, Math.round((now - since) / 1000)) : 0
}

export const fmtElapsed = (s) => (s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`)

export const JOB_STATUS = { running: 'Running', done: 'Finished', failed: 'Failed', cancelled: 'Cancelled', lost: 'Interrupted' }

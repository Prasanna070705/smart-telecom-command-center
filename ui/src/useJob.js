import { useEffect, useRef, useState } from 'react'
import { api } from './api.js'

// Starts a background job, polls it once a second until it stops running, and can cancel it.
export function useJob() {
  const [job, setJob] = useState(null); const [error, setError] = useState(null); const timer = useRef(null)
  useEffect(() => () => clearInterval(timer.current), [])
  const start = async (startFn, total) => {
    setError(null); clearInterval(timer.current)
    try {
      const { jobId } = await startFn()
      setJob({ id: jobId, status: 'running', progress: { done: 0, total, rows: [] } })
      timer.current = setInterval(async () => {
        try { const j = await api.job(jobId); setJob(j); if (j.status !== 'running') clearInterval(timer.current) } catch (e) { setError(e.message); clearInterval(timer.current) }
      }, 1000)
    } catch (e) { setError(e.message) }
  }
  const cancel = async () => {
    if (!job?.id) return
    clearInterval(timer.current)
    try { setJob(await api.cancelJob(job.id)) } catch (e) { setError(e.message) }
  }
  return { job, error, start, cancel, running: job?.status === 'running' }
}

export const JOB_STATUS = { running: 'Running', done: 'Finished', failed: 'Failed', cancelled: 'Cancelled' }

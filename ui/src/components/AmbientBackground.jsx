import { useEffect, useRef } from 'react'

// Ambient background: a slowly drifting "signal network" (dots, faint links, pulses travelling along links) and
// "signal waves" (rings broadcast from a tower point). Colour follows the current page and the theme.
// Decorative only: aria-hidden, no pointer events, 30 fps cap, paused while the tab is hidden, one still frame
// when the user prefers reduced motion.

const PAGE_RGB = {   // [light theme, dark theme], matching each page's dot in the sidebar
  overview: [[100, 116, 139], [148, 163, 184]],   // slate-500 / slate-400
  pricing: [[79, 70, 229], [129, 140, 248]],      // indigo-600 / indigo-400
  retention: [[5, 150, 105], [52, 211, 153]],     // emerald-600 / emerald-400
  coupling: [[217, 119, 6], [251, 191, 36]],      // amber-600 / amber-400
  checks: [[225, 29, 72], [251, 113, 133]],       // rose-600 / rose-400
}
const LINK = 150            // px: dots closer than this are linked
const SPEED = 9             // px per second: a node crosses a 1440 px screen in about 2.5 minutes
const WAVE_EVERY = 5        // s between broadcast rings
const WAVE_LIFE = 14        // s a ring takes to fade out
const PULSE_EVERY = 1.6     // s between pulses
const PULSE_TIME = 2.2      // s for a pulse to cross its link
const RIPPLE_LIFE = 1.6     // s for the ripple where a pulse lands

const rand = (a, b) => a + Math.random() * (b - a)
const isDark = () => document.documentElement.classList.contains('dark')

export function AmbientBackground({ page }) {
  const ref = useRef(null)
  const pageRef = useRef(page)
  const stillRef = useRef(() => {})

  useEffect(() => {
    const canvas = ref.current; const ctx = canvas.getContext('2d')
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    let w = 0, h = 0, nodes = [], waves = [], pulses = [], ripples = [], raf = 0, last = 0, t = 0, nextWave = 0, nextPulse = 1
    const rgb = [...PAGE_RGB[pageRef.current][isDark() ? 1 : 0]]

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      w = window.innerWidth; h = window.innerHeight
      canvas.width = w * dpr; canvas.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.min(70, Math.round((w * h) / 26000))
      nodes = Array.from({ length: n }, () => {
        const a = rand(0, 2 * Math.PI), v = rand(0.5, 1) * SPEED
        return { x: rand(0, w), y: rand(0, h), vx: Math.cos(a) * v, vy: Math.sin(a) * v }
      })
      if (reduce.matches) draw(0)
    }

    const draw = (dt) => {
      t += dt
      const dark = isDark(); const target = PAGE_RGB[pageRef.current][dark ? 1 : 0]
      for (let k = 0; k < 3; k++) rgb[k] += (target[k] - rgb[k]) * Math.min(1, dt * 2.5)   // fade to the new page colour
      const c = `${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0}`
      const A = dark ? 1 : 0.75                                                                // fainter on a light page
      ctx.clearRect(0, 0, w, h)

      // signal waves: rings from a tower point near the top right
      const tx = w * 0.86, ty = h * 0.12, maxR = Math.hypot(w, h) * 0.75
      if (t >= nextWave) { waves.push(t); nextWave = t + WAVE_EVERY }
      waves = waves.filter((s) => t - s < WAVE_LIFE)
      for (const s of waves) {
        const p = (t - s) / WAVE_LIFE
        ctx.strokeStyle = `rgba(${c},${(0.22 * (1 - p) * A).toFixed(3)})`; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(tx, ty, 20 + p * maxR, 0, 2 * Math.PI); ctx.stroke()
      }
      ctx.fillStyle = `rgba(${c},${(0.35 * A).toFixed(3)})`; ctx.beginPath(); ctx.arc(tx, ty, 3, 0, 2 * Math.PI); ctx.fill()

      // signal network: drift, wrap at the edges, link close pairs
      for (const n of nodes) {
        n.x += n.vx * dt; n.y += n.vy * dt
        if (n.x < -20) n.x = w + 20; else if (n.x > w + 20) n.x = -20
        if (n.y < -20) n.y = h + 20; else if (n.y > h + 20) n.y = -20
      }
      const links = []
      ctx.lineWidth = 1
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j], d = Math.hypot(a.x - b.x, a.y - b.y)
        if (d > LINK) continue
        links.push([i, j])
        ctx.strokeStyle = `rgba(${c},${(0.16 * (1 - d / LINK) * A).toFixed(3)})`
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      ctx.fillStyle = `rgba(${c},${(0.4 * A).toFixed(3)})`
      for (const n of nodes) { ctx.beginPath(); ctx.arc(n.x, n.y, 1.8, 0, 2 * Math.PI); ctx.fill() }

      // pulses travel along a link and leave a small ripple where they land
      if (t >= nextPulse && links.length) { const [i, j] = links[(Math.random() * links.length) | 0]; pulses.push({ a: i, b: j, s: t }); nextPulse = t + PULSE_EVERY }
      pulses = pulses.filter((p) => {
        const f = (t - p.s) / PULSE_TIME, a = nodes[p.a], b = nodes[p.b]
        if (f >= 1) { ripples.push({ n: p.b, s: t }); return false }
        const x = a.x + (b.x - a.x) * f, y = a.y + (b.y - a.y) * f
        ctx.fillStyle = `rgba(${c},${(0.85 * A).toFixed(3)})`; ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI); ctx.fill()
        return true
      })
      ripples = ripples.filter((r) => {
        const p = (t - r.s) / RIPPLE_LIFE; if (p >= 1) return false
        const n = nodes[r.n]; ctx.strokeStyle = `rgba(${c},${(0.5 * (1 - p) * A).toFixed(3)})`
        ctx.beginPath(); ctx.arc(n.x, n.y, 3 + p * 22, 0, 2 * Math.PI); ctx.stroke(); return true
      })
    }

    const frame = (now) => {
      raf = requestAnimationFrame(frame)
      if (now - last < 1000 / 30) return                 // 30 fps is plenty for motion this slow
      const dt = last ? Math.min((now - last) / 1000, 0.1) : 0; last = now
      draw(dt)
    }
    const start = () => { cancelAnimationFrame(raf); last = 0; if (reduce.matches) draw(0); else raf = requestAnimationFrame(frame) }
    const onVisible = () => (document.hidden ? cancelAnimationFrame(raf) : start())
    // A still frame must be redrawn when the theme or page changes, since nothing animates it.
    const still = () => { if (reduce.matches) { for (let k = 0; k < 3; k++) rgb[k] = PAGE_RGB[pageRef.current][isDark() ? 1 : 0][k]; draw(0) } }
    const themeObserver = new MutationObserver(still)

    resize(); start()
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisible)
    reduce.addEventListener('change', start)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    stillRef.current = still
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisible); reduce.removeEventListener('change', start); themeObserver.disconnect()
    }
  }, [])

  useEffect(() => { pageRef.current = page; stillRef.current() }, [page])

  return <canvas ref={ref} data-ambient aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 h-full w-full" />
}

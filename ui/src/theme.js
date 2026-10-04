import { useEffect, useState } from 'react'

// 'light' | 'dark' | 'system'. Stored per browser; index.html applies it before React loads, so there is no flash.
const KEY = 'theme'
const media = () => window.matchMedia('(prefers-color-scheme: dark)')
const read = () => { try { return localStorage.getItem(KEY) || 'system' } catch { return 'system' } }

export function applyTheme(theme) {
  const dark = theme === 'dark' || (theme === 'system' && media().matches)
  document.documentElement.classList.toggle('dark', dark)
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light'   // native controls and scrollbars follow
}

let fadeTimer
// Called on a user switch (not on first load): colours fade instead of snapping.
function fadeColours() {
  const el = document.documentElement; el.classList.add('theme-fade')
  clearTimeout(fadeTimer); fadeTimer = setTimeout(() => el.classList.remove('theme-fade'), 300)
}

export function useTheme() {
  const [theme, setTheme] = useState(read)
  useEffect(() => {
    applyTheme(theme)
    try { if (theme === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, theme) } catch { /* private mode */ }
    if (theme !== 'system') return
    const m = media(); const on = () => applyTheme('system')
    m.addEventListener('change', on); return () => m.removeEventListener('change', on)
  }, [theme])
  return [theme, (t) => { fadeColours(); setTheme(t) }]
}

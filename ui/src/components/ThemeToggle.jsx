const OPTIONS = [
  { id: 'light', label: 'Light', icon: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></> },
  { id: 'system', label: 'System', icon: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4" /></> },
  { id: 'dark', label: 'Dark', icon: <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /> },
]

// Three-way theme switch for the header; `theme` and `onChange` come from useTheme().
export function ThemeToggle({ theme, onChange }) {
  return (
    <div role="group" aria-label="Colour theme" className="inline-flex rounded-full bg-slate-100 p-0.5 ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700">
      {OPTIONS.map((o) => (
        <button key={o.id} type="button" aria-pressed={theme === o.id} title={`${o.label} theme`} onClick={() => onChange(o.id)}
          className={`rounded-full p-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 ${theme === o.id ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100'}`}>
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{o.icon}</svg>
          <span className="sr-only">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

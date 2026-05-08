'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/store/uiStore'

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    const root = document.documentElement
    const mq   = window.matchMedia('(prefers-color-scheme: dark)')

    function applyTheme(t: typeof theme) {
      const isDark = t === 'dark' || (t === 'system' && mq.matches)
      root.classList.toggle('dark', isDark)
      root.classList.toggle('light', !isDark)
    }

    applyTheme(theme)

    const listener = () => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', listener)
    return () => mq.removeEventListener('change', listener)
  }, [theme])

  return <>{children}</>
}

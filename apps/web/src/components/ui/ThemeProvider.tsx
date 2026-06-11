'use client'
import { useEffect } from 'react'
import { THEMES } from '@/lib/themes'
import { Theme } from '@spenlog/types'

const DEFAULT: Theme = 'Burgundy'

export default function ThemeProvider({ theme }: { theme?: string | null }) {
  useEffect(() => {
    const t = THEMES[(theme as Theme) ?? DEFAULT] ?? THEMES[DEFAULT]
    const root = document.documentElement
    root.style.setProperty('--color-primary', t.primary)
    root.style.setProperty('--color-primary-mid', t.primaryMid)
    root.style.setProperty('--color-primary-light', t.primaryLight)
    root.style.setProperty('--color-accent', t.accent)
    root.style.setProperty('--color-bg', t.bg)
    document.body.style.background = t.bg
  }, [theme])

  return null
}

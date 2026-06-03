'use client'
import { useEffect } from 'react'

export default function DarkModeInit() {
  useEffect(() => {
    const saved = localStorage.getItem('spenlog-dark')
    if (saved === 'true') {
      document.documentElement.setAttribute('data-theme', 'dark')
    }
  }, [])
  return null
}

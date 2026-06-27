'use client'
import { useEffect, useState } from 'react'
import SettingsForm from './SettingsForm'

const CACHE_KEY = 'sp_settings_v1'
const CACHE_TTL = 5 * 60 * 1000

export default function SettingsDataLoader() {
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { d, ts } = JSON.parse(cached)
        setData(d)
        if (Date.now() - ts < CACHE_TTL) return
      }
    } catch {}
    fetch('/api/settings-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        setData(fresh)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }, [])

  if (!data) return <div style={{ minHeight: '100vh' }} />

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <h1 className="text-lg font-semibold mb-5" style={{ color: 'var(--color-accent)' }}>설정</h1>
      <SettingsForm
        profile={data.profile}
        userId={data.userId}
        email={data.email}
        provider={data.provider}
        isGuest={data.isGuest}
        hasGoogle={data.hasGoogle}
      />
    </div>
  )
}

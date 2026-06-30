'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
import SettingsForm from './SettingsForm'

const CACHE_KEY = 'sp_settings_v1'
const CACHE_TTL = 5 * 60 * 1000

let _memCache: any = null

export default function SettingsDataLoader() {
  const [data, setData] = useState<any>(_memCache)

  useLayoutEffect(() => {
    if (_memCache) return
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { d } = JSON.parse(cached)
        _memCache = d
        setData(d)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const { ts } = JSON.parse(cached)
        if (Date.now() - ts < CACHE_TTL) return
      }
    } catch {}
    fetch('/api/settings-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        _memCache = fresh
        setData(fresh)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
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

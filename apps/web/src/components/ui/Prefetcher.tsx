'use client'
import { useEffect } from 'react'

const ENDPOINTS = [
  { url: '/api/assets-data', key: 'sp_assets_v2' },
  { url: '/api/history-data', key: 'sp_history_v2' },
  { url: '/api/home-data', key: 'sp_home_v1' },
  { url: '/api/settings-data', key: 'sp_settings_v1' },
]
const CACHE_TTL = 5 * 60 * 1000

export default function Prefetcher({ userId }: { userId: string }) {
  useEffect(() => {
    if (!userId) return
    // 각 탭 데이터를 백그라운드에서 미리 fetch
    ENDPOINTS.forEach(({ url, key }) => {
      try {
        const cached = localStorage.getItem(key)
        if (cached) {
          const { ts } = JSON.parse(cached)
          if (Date.now() - ts < CACHE_TTL) return // 신선한 캐시 있으면 skip
        }
      } catch {}
      fetch(url)
        .then(r => r.json())
        .then(data => {
          if (data.error) return
          try { localStorage.setItem(key, JSON.stringify({ d: data, ts: Date.now() })) } catch {}
        })
        .catch(() => {})
    })
  }, [userId])

  return null
}

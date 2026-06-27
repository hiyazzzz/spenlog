'use client'
import { useEffect, useState } from 'react'
import HomeClient from './HomeClient'

const CACHE_KEY = 'sp_home_v1'
const CACHE_TTL = 5 * 60 * 1000

interface HomeData {
  userId: string
  profile: any
  expenses: any[]
  budgets: any[]
  userCategories: any[]
}

function Sk({ w, h, r = '10px' }: { w: string; h: string; r?: string }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: '#f0f0f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <div style={{ height: 200, borderRadius: 16, overflow: 'hidden', background: '#f0f0f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', padding: 20, minHeight: 120 }}>
        <Sk w="80px" h="14px" r="6px" />
        <div style={{ marginTop: 12 }}><Sk w="100%" h="44px" r="12px" /></div>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', padding: 20, minHeight: 160 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[0,1,2,3].map(i => <Sk key={i} w="100%" h="80px" r="12px" />)}
        </div>
      </div>
      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #f3f4f6', padding: 20, minHeight: 120 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 10, marginBottom: 10, borderBottom: i < 2 ? '1px solid #f9f9f9' : 'none' }}>
            <Sk w="100px" h="14px" r="6px" />
            <Sk w="60px" h="14px" r="6px" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function HomeDataLoader() {
  const [data, setData] = useState<HomeData | null>(null)

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { d, ts } = JSON.parse(cached)
        setData(d)
        if (Date.now() - ts < CACHE_TTL) return
      }
    } catch {}
    fetch('/api/home-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        setData(fresh)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }, [])

  if (!data) return <LoadingSkeleton />
  return <HomeClient {...data} />
}

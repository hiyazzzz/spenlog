'use client'
import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import HistoryClient from './HistoryClient'

const CACHE_KEY = 'sp_history_v2'
const CACHE_TTL = 60 * 1000

interface HistoryData {
  expenses: any[]
  paymentMethods: string[]
  userCategories: string[]
}

function Sk({ w, h, r = '10px' }: { w: string; h: string; r?: string }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: '#f0f0f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Sk w="48px" h="24px" /><div style={{ display: 'flex', gap: 8 }}><Sk w="32px" h="32px" r="50%" /><Sk w="32px" h="32px" r="50%" /></div>
      </div>
      <Sk w="100%" h="40px" r="12px" />
      <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
        {[60, 90, 80, 70].map((w, i) => <Sk key={i} w={w + 'px'} h="30px" r="20px" />)}
      </div>
      {[0, 1, 2].map(g => (
        <div key={g} style={{ marginBottom: 16 }}>
          <Sk w="80px" h="14px" r="6px" />
          <div style={{ marginTop: 8, background: '#fff', borderRadius: 16, overflow: 'hidden' }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: i < 2 ? '1px solid #f9f9f9' : 'none' }}>
                <div><Sk w="100px" h="14px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="70px" h="11px" r="6px" /></div></div>
                <Sk w="60px" h="16px" r="6px" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function HistoryDataLoader({ userId }: { userId: string }) {
  const [data, setData] = useState<HistoryData | null>(null)
  const searchParams = useSearchParams()
  const initialCategory = searchParams.get('category') ?? ''

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { d, ts } = JSON.parse(cached)
        setData(d)
        if (Date.now() - ts < CACHE_TTL) return
      }
    } catch {}

    fetch('/api/history-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        setData(fresh)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }, [userId])

  if (!data) return <LoadingSkeleton />

  return (
    <HistoryClient
      userId={userId}
      initialExpenses={data.expenses}
      paymentMethods={data.paymentMethods}
      userCategories={data.userCategories}
      initialCategory={initialCategory}
    />
  )
}

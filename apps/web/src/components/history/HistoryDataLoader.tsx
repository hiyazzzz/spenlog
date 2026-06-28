'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, usePathname } from 'next/navigation'
import HistoryClient from './HistoryClient'

const CACHE_KEY = 'sp_history_v2'
const CACHE_TTL = 5 * 60 * 1000

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

  function fetchHistory(force = false) {
    if (!force) {
      try {
        const cached = sessionStorage.getItem(CACHE_KEY)
        if (cached) {
          const { d, ts } = JSON.parse(cached)
          setData(d)
          if (Date.now() - ts < CACHE_TTL) return
        }
      } catch {}
    }
    fetch('/api/history-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        setData(fresh)
        try { sessionStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }

  // 최초 마운트 시 로드
  useEffect(() => { fetchHistory() }, [userId])

  // /history 탭 진입 시마다 재확인 — TabShell이 모든 탭을 pre-mount하기 때문에 필요
  const pathname = usePathname()
  useEffect(() => {
    if (pathname !== '/history') return
    // 저장 직후 강제 새로고침 플래그 — Prefetcher race condition 완전 차단
    try {
      if (sessionStorage.getItem('sp_history_needs_refresh') === '1') {
        sessionStorage.removeItem('sp_history_needs_refresh')
        sessionStorage.removeItem(CACHE_KEY)
        fetchHistory(true)
        return
      }
    } catch {}
    // 10초 이내 데이터는 재요청 생략 (초기 로드 직후 이중 요청 방지)
    try {
      const cached = sessionStorage.getItem(CACHE_KEY)
      if (cached) {
        const { ts } = JSON.parse(cached)
        if (Date.now() - ts < 10000) return
      }
    } catch {}
    // 캐시 삭제 후 재조회
    try { sessionStorage.removeItem(CACHE_KEY) } catch {}
    fetchHistory(true)
  }, [pathname])

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

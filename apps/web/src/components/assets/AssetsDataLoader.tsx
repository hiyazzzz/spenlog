'use client'
import { useEffect, useState } from 'react'
import AssetsClient from './AssetsClient'

const CACHE_KEY = 'sp_assets_v2'
const CACHE_TTL = 5 * 60 * 1000 // 60초

interface AssetsData {
  profile: any; accounts: any[]; cards: any[]; fixedCosts: any[]
  budgets: any[]; thisMonthSpent: number; categorySpent: Record<string, number>
  thisMonth: string; customCategories: any[]; expenses: any[]; recentExpenses: any[]
}

function Sk({ w, h, r = '10px' }: { w: string; h: string; r?: string }) {
  return <div style={{ width: w, height: h, borderRadius: r, background: '#f0f0f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
}

function LoadingSkeleton() {
  return (
    <div style={{ paddingBottom: 80 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      <div style={{ background: '#fff', borderRadius: 20, padding: 20, marginBottom: 16 }}>
        <Sk w="80px" h="12px" r="6px" />
        <div style={{ marginTop: 8 }}><Sk w="160px" h="36px" r="6px" /></div>
        <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><Sk w="60px" h="12px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="90px" h="20px" r="6px" /></div></div>
          <div><Sk w="60px" h="12px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="90px" h="20px" r="6px" /></div></div>
        </div>
      </div>
      {[0, 1].map(s => (
        <div key={s} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <Sk w="60px" h="16px" r="6px" /><Sk w="40px" h="16px" r="6px" />
          </div>
          {[0, 1].map(i => (
            <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 16, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div><Sk w="80px" h="14px" r="6px" /><div style={{ marginTop: 6 }}><Sk w="55px" h="11px" r="6px" /></div></div>
              <Sk w="80px" h="18px" r="6px" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

export default function AssetsDataLoader({ userId }: { userId: string }) {
  // lazy initializer: localStorage를 동기적으로 읽어 첫 render부터 캐시 데이터 사용
  // → skeleton flash(layout shift) 방지
  const [data, setData] = useState<AssetsData | null>(() => {
    if (typeof window === 'undefined') return null
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (raw) {
        const { d } = JSON.parse(raw)
        if (d && typeof d === 'object') return d  // 유효한 데이터만 사용
      }
    } catch {}
    return null
  })
  const [fetchError, setFetchError] = useState(false)

  useEffect(() => {
    setFetchError(false)
    // data가 없으면 항상 fetch (캐시 신선도 무관)
    // data가 있으면 stale 여부만 확인 후 background revalidate
    let needsFetch = true
    if (data) {
      try {
        const raw = localStorage.getItem(CACHE_KEY)
        if (raw) {
          const { ts } = JSON.parse(raw)
          if (Date.now() - ts < CACHE_TTL) needsFetch = false
        }
      } catch {}
    }

    if (!needsFetch) return

    fetch('/api/assets-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) {
          if (!data) setFetchError(true)  // data 없을 때만 에러 표시
          return
        }
        setData(fresh)
        setFetchError(false)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => { if (!data) setFetchError(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (!data) {
    if (fetchError) return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        데이터를 불러오지 못했어요. 새로고침 해주세요.
      </div>
    )
    return <LoadingSkeleton />
  }

  return (
    <AssetsClient
      profile={data.profile}
      userId={userId}
      accounts={data.accounts}
      cards={data.cards}
      fixedCosts={data.fixedCosts}
      budgets={data.budgets}
      thisMonthSpent={data.thisMonthSpent}
      categorySpent={data.categorySpent}
      thisMonth={data.thisMonth}
      customCategories={data.customCategories}
      expenses={data.expenses}
      recentExpenses={data.recentExpenses}
    />
  )
}

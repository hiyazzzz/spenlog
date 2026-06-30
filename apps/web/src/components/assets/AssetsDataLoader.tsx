'use client'
import { useEffect, useLayoutEffect, useState } from 'react'
import AssetsClient from './AssetsClient'

const CACHE_KEY = 'sp_assets_v2'
const CACHE_TTL = 5 * 60 * 1000 // 5분

// 모듈 레벨 캐시 — React remount(탭 전환)에도 보존됨
let _memCache: any = null

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
  // 탭 전환(remount) 시 모듈 캐시에서 즉시 복원 → skeleton 없음
  const [data, setData] = useState<AssetsData | null>(_memCache)

  useLayoutEffect(() => {
    if (_memCache) return // 모듈 캐시 있으면 스킵
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
    fetch('/api/assets-data')
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        _memCache = fresh
        setData(fresh)
        try { localStorage.setItem(CACHE_KEY, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }, [userId])

  if (!data) return <LoadingSkeleton />

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

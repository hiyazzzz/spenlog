'use client'
import { useEffect, useLayoutEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import ReportClient from './ReportClient'

const CACHE_TTL = 5 * 60 * 1000

// month별 모듈 캐시
const _memCacheMap: Record<string, any> = {}

function LoadingSkeleton() {
  return (
    <div style={{ minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }`}</style>
      {[0,1,2].map(i => (
        <div key={i} style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }}>
          <div style={{ height: 14, width: 80, borderRadius: 6, background: '#f0f0f0', marginBottom: 12 }} />
          <div style={{ height: 80, borderRadius: 8, background: '#f0f0f0' }} />
        </div>
      ))}
    </div>
  )
}

export default function ReportDataLoader() {
  const searchParams = useSearchParams()
  const month = searchParams.get('month') ?? ''
  const cacheKey = `sp_report_v1_${month || 'default'}`

  const [data, setData] = useState<any>(_memCacheMap[month || 'default'] ?? null)

  useLayoutEffect(() => {
    const mk = month || 'default'
    if (_memCacheMap[mk]) return
    try {
      const cached = localStorage.getItem(`sp_report_v1_${mk}`)
      if (cached) {
        const { d } = JSON.parse(cached)
        _memCacheMap[mk] = d
        setData(d)
      }
    } catch {}
  }, [month])

  const load = useCallback(async (m: string) => {
    const mk = m || 'default'
    const lsKey = `sp_report_v1_${mk}`
    try {
      const cached = localStorage.getItem(lsKey)
      if (cached) {
        const { d, ts } = JSON.parse(cached)
        _memCacheMap[mk] = d
        setData(d)
        if (Date.now() - ts < CACHE_TTL) return
      }
    } catch {}
    const url = m ? `/api/report-data?month=${m}` : '/api/report-data'
    fetch(url)
      .then(r => r.json())
      .then(fresh => {
        if (fresh.error) return
        const fmk = fresh.currentMonth || m || 'default'
        _memCacheMap[fmk] = fresh
        setData(fresh)
        try { localStorage.setItem(`sp_report_v1_${fmk}`, JSON.stringify({ d: fresh, ts: Date.now() })) } catch {}
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    load(month)
  }, [month, load])

  if (!data) return <LoadingSkeleton />

  return (
    <ReportClient
      userId={data.userId}
      currentMonth={data.currentMonth}
      prevMonth={data.prevMonth}
      maxMonth={data.maxMonth}
      totalSpent={data.totalSpent}
      prevTotalSpent={data.prevTotalSpent}
      spendingDiff={data.spendingDiff}
      savingGoal={data.savingGoal}
      savedAmount={data.savedAmount}
      savingPct={data.savingPct}
      catData={data.catData}
      topItems={data.topItems}
      txnCount={data.txnCount}
      threeMonths={data.threeMonths}
      maxTotal={data.maxTotal}
      patternComment={data.patternComment}
      cachedCoach={data.cachedCoach}
      hasEnoughData={data.hasEnoughData}
    />
  )
}

'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function BudgetError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter()
  useEffect(() => {
    console.error('[budget] error:', error)
  }, [error])
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24,
    }}>
      <p style={{ fontSize: 15, color: '#6b7280', textAlign: 'center' }}>
        예산 페이지를 불러오는 중 오류가 발생했어요
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={reset} style={{
          padding: '10px 20px', borderRadius: 12, border: 'none',
          background: 'var(--color-primary)', color: '#fff',
          fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          다시 시도
        </button>
        <button onClick={() => router.back()} style={{
          padding: '10px 20px', borderRadius: 12,
          border: '1px solid #e5e7eb', background: '#fff',
          fontSize: 14, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
        }}>
          뒤로가기
        </button>
      </div>
    </div>
  )
}

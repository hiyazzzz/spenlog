'use client'
import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'

export default function HomeFAB() {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  // 홈 탭에서만 표시
  if (pathname !== '/') return null

  function goTo(type: 'expense' | 'income') {
    setOpen(false)
    router.push(`/add?type=${type}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed z-40 flex items-center justify-center rounded-full text-white shadow-lg transition-transform active:scale-95"
        style={{
          bottom: 80, right: 20,
          width: 44, height: 44,
          background: 'var(--color-border)',
          boxShadow: 'none',
        }}
        aria-label="기록하기"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-6" />
            <p className="text-sm font-bold text-gray-700 mb-4 text-center">무엇을 기록할까요?</p>
            <div className="flex gap-3">
              <button
                onClick={() => goTo('expense')}
                className="flex-1 py-4 rounded-2xl text-white text-sm font-bold"
                style={{ background: 'var(--color-primary)' }}
              >
                💸 지출 기록
              </button>
              <button
                onClick={() => goTo('income')}
                className="flex-1 py-4 rounded-2xl text-sm font-bold border-2"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                💰 수입 기록
              </button>
            </div>
            <div className="h-safe-bottom" />
          </div>
        </div>
      )}
    </>
  )
}

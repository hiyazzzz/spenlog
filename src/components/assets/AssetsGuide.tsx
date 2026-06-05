'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const GUIDE_KEY = 'spenlog_asset_guide_shown'

const GUIDE_STEPS = [
  {
    emoji: '🏦',
    title: '먼저 계좌를 등록해요',
    desc: '내 계좌와 잔액을 입력하면\n모든 거래가 자동으로 반영돼요',
    highlight: '계좌 / 현금 섹션',
  },
  {
    emoji: '💳',
    title: '카드에 계좌를 연결해요',
    desc: '카드를 등록하고 출금 계좌를 연결하면\n결제 시 잔액이 자동으로 차감돼요',
    highlight: '카드 섹션',
  },
  {
    emoji: '📌',
    title: '고정비에도 계좌 연결',
    desc: '넷플릭스, 관리비 등 고정 지출과\n적금·저축에 출금 계좌를 연결해요',
    highlight: '고정비 섹션',
  },
  {
    emoji: '✅',
    title: '루틴 기록으로 한번에',
    desc: '매달 루틴 배너에서 기록하면\n연결된 계좌 잔액이 자동으로 반영돼요',
    highlight: '루틴 배너',
  },
]

export default function AssetsGuide() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const router = useRouter()

  useEffect(() => {
    // localStorage 플래그 확인
    if (typeof window !== 'undefined') {
      const shown = localStorage.getItem(GUIDE_KEY)
      if (!shown) setShow(true)
    }
  }, [])

  function dismiss(goAccount = false) {
    if (typeof window !== 'undefined') {
      localStorage.setItem(GUIDE_KEY, '1')
    }
    setShow(false)
    if (goAccount) {
      // 계좌 섹션으로 스크롤 유도 (해당 섹션이 DOM에 있으면 클릭)
      setTimeout(() => {
        const sections = document.querySelectorAll('button')
        sections.forEach(btn => {
          if (btn.textContent?.includes('계좌 / 현금')) btn.click()
        })
      }, 100)
    }
  }

  if (!show) return null

  const current = GUIDE_STEPS[step]
  const isLast = step === GUIDE_STEPS.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end' }}>
      {/* 배경 오버레이 */}
      <div
        onClick={() => dismiss(false)}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)' }}
      />

      {/* 가이드 카드 (Bottom Sheet) */}
      <div style={{
        position: 'relative', width: '100%', background: '#fff',
        borderRadius: '24px 24px 0 0', padding: '28px 24px 48px',
        zIndex: 1,
      }}>
        {/* 핸들 바 */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        {/* 진행 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
          {GUIDE_STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 3,
              background: i === step ? 'var(--color-primary)' : '#e5e7eb',
              transition: 'all 0.25s',
            }} />
          ))}
        </div>

        {/* 컨텐츠 */}
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>{current.emoji}</div>
          <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1f2937', marginBottom: 10 }}>
            {current.title}
          </h3>
          <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
            {current.desc}
          </p>
          <div style={{
            display: 'inline-block', marginTop: 12,
            background: 'var(--color-primary-light)', color: 'var(--color-primary)',
            fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20,
          }}>
            👆 {current.highlight}
          </div>
        </div>

        {/* 버튼 */}
        {isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button onClick={() => dismiss(true)} style={{
              width: '100%', padding: '15px', borderRadius: 16,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              계좌 먼저 입력해볼게요 →
            </button>
            <button onClick={() => dismiss(false)} style={{
              width: '100%', padding: '13px', borderRadius: 16,
              background: '#f3f4f6', color: '#6b7280',
              fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              나중에
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10 }}>
            {step > 0 && (
              <button onClick={() => setStep(s => s - 1)} style={{
                flex: '0 0 80px', padding: '14px', borderRadius: 16,
                background: '#f3f4f6', color: '#6b7280',
                fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>← 이전</button>
            )}
            <button onClick={() => setStep(s => s + 1)} style={{
              flex: 1, padding: '14px', borderRadius: 16,
              background: 'var(--color-primary)', color: '#fff',
              fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>다음 →</button>
          </div>
        )}
      </div>
    </div>
  )
}

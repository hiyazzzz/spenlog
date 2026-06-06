'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

const GUIDE_KEY = 'spenlog_asset_guide_shown'

const GUIDE_STEPS = [
  {
    emoji: '🏦',
    title: '먼저 계좌를 등록해요',
    desc: '내 계좌와 잔액을 입력하면\n모든 거래가 자동으로 반영돼요',
    tag: '👆 계좌 / 현금 섹션',
    arrowDown: true,
  },
  {
    emoji: '💳',
    title: '카드에 계좌를 연결해요',
    desc: '카드를 등록하고 출금 계좌를 연결하면\n결제 시 잔액이 자동으로 차감돼요',
    tag: '👆 카드 섹션',
    arrowDown: true,
  },
  {
    emoji: '📌',
    title: '고정비에도 계좌 연결',
    desc: '넷플릭스, 관리비 등 고정 지출과\n적금·저축에 출금 계좌를 연결해요',
    tag: '👆 고정비 섹션',
    arrowDown: true,
  },
  {
    emoji: '✅',
    title: '루틴 기록으로 한번에',
    desc: '매달 루틴 배너에서 기록하면\n연결된 계좌 잔액이 자동으로 반영돼요',
    tag: '👆 루틴 배너',
    arrowDown: false,
  },
]

// 손글씨 스타일 화살표
function HandArrow({ down }: { down: boolean }) {
  return (
    <svg width="32" height="52" viewBox="0 0 32 52" fill="none"
      style={{ display: 'block', margin: '0 auto', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
      {down ? (
        <path d="M16 4 C14 16, 18 28, 16 44 M16 44 L9 34 M16 44 L23 34"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d="M16 48 C14 36, 18 24, 16 8 M16 8 L9 18 M16 8 L23 18"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  )
}

export default function AssetsGuide() {
  const [show, setShow] = useState(false)
  const [step, setStep] = useState(0)
  const router = useRouter()

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem(GUIDE_KEY)) {
      setShow(true)
    }
  }, [])

  function dismiss(scroll = false) {
    if (typeof window !== 'undefined') localStorage.setItem(GUIDE_KEY, '1')
    setShow(false)
    if (scroll) {
      setTimeout(() => {
        const btns = document.querySelectorAll('button')
        btns.forEach(b => { if (b.textContent?.includes('계좌 / 현금')) b.click() })
      }, 100)
    }
  }

  if (!show) return null

  const current = GUIDE_STEPS[step]
  const isLast = step === GUIDE_STEPS.length - 1

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* 다크 오버레이 */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)' }} onClick={() => dismiss(false)} />

      {/* 상단: 카운터 + 건너뛰기 */}
      <div style={{
        position: 'fixed', top: 16, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', padding: '0 20px', zIndex: 10001,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
          {step + 1} / {GUIDE_STEPS.length}
        </span>
        <button onClick={() => dismiss(false)} style={{
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)',
          backdropFilter: 'blur(8px)', color: 'white', fontSize: 13,
          padding: '6px 16px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
        }}>건너뛰기</button>
      </div>

      {/* 도트 인디케이터 */}
      <div style={{
        position: 'fixed', top: 54, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10001,
      }}>
        {GUIDE_STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 6, height: 6, borderRadius: 3,
            background: i === step ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      {/* 중앙 팝업 + 화살표 */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(calc(100% - 40px), 340px)',
        zIndex: 10001,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* 위 화살표 (마지막 스텝 - 루틴 배너는 위에 있음) */}
        {!current.arrowDown && (
          <div style={{ marginBottom: 6 }}><HandArrow down={false} /></div>
        )}

        {/* 팝업 카드 */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(16px)',
          borderRadius: 24,
          padding: '24px 24px 20px',
          boxShadow: '0 16px 48px rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.8)',
        }}>
          {/* 이모지 + 태그 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <span style={{ fontSize: 40 }}>{current.emoji}</span>
            <span style={{
              fontSize: 11, fontWeight: 700,
              background: 'var(--color-primary-light)', color: 'var(--color-primary)',
              padding: '4px 10px', borderRadius: 20,
            }}>{current.tag}</span>
          </div>

          <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>
            {current.title}
          </h3>
          <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7, marginBottom: 20, whiteSpace: 'pre-line' }}>
            {current.desc}
          </p>

          {isLast ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 4 }}>
                지금 계좌를 입력하면 가계부 초기 설정이 완성돼요! 🎯
              </p>
              <button onClick={() => dismiss(true)} style={{
                width: '100%', padding: '13px', borderRadius: 14,
                background: 'var(--color-primary)', color: 'white',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>계좌 먼저 입력할게요 →</button>
              <button onClick={() => dismiss(false)} style={{
                width: '100%', padding: '11px', borderRadius: 14,
                background: '#f3f4f6', color: '#6b7280',
                fontSize: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>나중에</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {step > 0 ? (
                <button onClick={() => setStep(s => s - 1)} style={{
                  background: 'none', border: 'none', color: '#9ca3af',
                  fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                }}>← 이전</button>
              ) : <div />}
              <button onClick={() => setStep(s => s + 1)} style={{
                padding: '11px 28px', borderRadius: 14,
                background: 'var(--color-primary)', color: 'white',
                fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>다음 →</button>
            </div>
          )}
        </div>

        {/* 아래 화살표 (대부분의 스텝 - 섹션이 아래에 있음) */}
        {current.arrowDown && (
          <div style={{ marginTop: 6 }}><HandArrow down={true} /></div>
        )}
      </div>
    </div>
  )
}

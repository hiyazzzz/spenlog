'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Step {
  title: string
  desc: string
  highlight: 'ai' | 'nav-0' | 'nav-1' | 'nav-2' | 'nav-3'
  arrowDir: 'down' | 'up' | 'left' | 'right'
  isFinal?: boolean
}

const STEPS: Step[] = [
  {
    title: '여기서 지출을 기록해요',
    desc: '"스타벅스 육천원 카드" 한 줄이면\nAI가 자동으로 분류해줘요!',
    highlight: 'ai',
    arrowDir: 'down',
  },
  {
    title: '홈에서 한눈에 확인',
    desc: '이번 달 지출 현황과\n예산 달성률을 볼 수 있어요',
    highlight: 'nav-0',
    arrowDir: 'down',
  },
  {
    title: '내역에서 기록 확인',
    desc: '모든 수입·지출 내역을\n날짜·카테고리별로 확인해요',
    highlight: 'nav-1',
    arrowDir: 'down',
  },
  {
    title: '리포트로 패턴 파악',
    desc: '월간 소비 패턴을 보고\nAI와 함께 다음 달을 계획해요',
    highlight: 'nav-3',
    arrowDir: 'down',
  },
  {
    title: '자산을 한 곳에서 관리',
    desc: '계좌·카드·고정비를\n모두 연결해 관리할 수 있어요',
    highlight: 'nav-2',
    arrowDir: 'down',
    isFinal: true,
  },
]

interface Props { userId: string }

export default function GuideOverlay({ userId }: Props) {
  const [step, setStep] = useState(0)
  const [visible, setVisible] = useState(true)
  const supabase = createClient()
  const router = useRouter()

  async function dismiss(goAssets = false) {
    setVisible(false)
    await supabase.from('users').update({ guide_completed: true }).eq('id', userId)
    if (goAssets) router.push('/assets')
    else router.refresh()
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isAboveNav = current.highlight === 'ai'

  function getHighlightStyle(): React.CSSProperties {
    if (current.highlight === 'ai') {
      return {
        position: 'fixed',
        bottom: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 420px)',
        height: 110,
        borderRadius: 20,
      }
    }
    const navIdx = parseInt(current.highlight.split('-')[1])
    return {
      position: 'fixed',
      bottom: 0,
      left: `${navIdx * 20}%`,
      width: '20%',
      height: 64,
      borderRadius: '12px 12px 0 0',
    }
  }

  const hlStyle = getHighlightStyle()

  // 손글씨 스타일 화살표 SVG
  function ArrowSVG() {
    return (
      <svg width="40" height="48" viewBox="0 0 40 48" fill="none"
        style={{ display: 'block', margin: '0 auto' }}>
        <path
          d="M20 4 C18 12, 22 20, 20 32 M20 32 L14 24 M20 32 L26 24"
          stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          fill="none"
          style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.4))' }}
        />
      </svg>
    )
  }

  const cardAbove = isAboveNav
  // 카드 위치: AI 하이라이트면 더 위로, nav는 하이라이트 바로 위
  const cardBottom = cardAbove ? 220 : 86

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* 전체 어두운 오버레이 */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', pointerEvents: 'none' }} />

      {/* 하이라이트 컷아웃 */}
      <div style={{
        ...hlStyle,
        background: 'rgba(255,255,255,0.12)',
        outline: '3px solid rgba(255,255,255,0.85)',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.72), 0 0 24px rgba(255,255,255,0.3)',
        pointerEvents: 'none',
      }} />

      {/* 상단 바: 스텝 카운터 + 건너뛰기 */}
      <div style={{
        position: 'fixed', top: 16, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 20px', zIndex: 10001,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: 600 }}>
          {step + 1} / {STEPS.length}
        </span>
        <button onClick={() => dismiss(false)} style={{
          background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.35)',
          backdropFilter: 'blur(8px)',
          color: 'white', fontSize: 13, padding: '6px 16px', borderRadius: 20,
          cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500,
        }}>
          건너뛰기
        </button>
      </div>

      {/* 도트 인디케이터 */}
      <div style={{
        position: 'fixed', top: 54, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10001,
      }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 22 : 6, height: 6, borderRadius: 3,
            background: i === step ? 'white' : 'rgba(255,255,255,0.3)',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      {/* 화살표 (하이라이트 바로 위) */}
      <div style={{
        position: 'fixed',
        bottom: cardBottom - 52,
        left: '50%', transform: 'translateX(-50%)',
        zIndex: 10001,
      }}>
        <ArrowSVG />
      </div>

      {/* 말풍선 카드 — 반투명 흰색, 더 크고 선명하게 */}
      <div style={{
        position: 'fixed',
        bottom: cardBottom,
        left: '50%', transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 360px)',
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        borderRadius: 22,
        padding: '22px 24px',
        zIndex: 10001,
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        border: '1px solid rgba(255,255,255,0.8)',
      }}>
        <h3 style={{ fontSize: 17, fontWeight: 800, color: '#1f2937', marginBottom: 8 }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 14, color: '#4b5563', lineHeight: 1.7, marginBottom: 18, whiteSpace: 'pre-line' }}>
          {current.desc}
        </p>

        {isLast ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>
              지금 자산을 입력하면 가계부 초기 설정이 완성돼요! 🎯
            </p>
            <button onClick={() => dismiss(true)} style={{
              width: '100%', padding: '13px', borderRadius: 14,
              background: 'var(--color-primary, #6B1E2E)',
              color: 'white', fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              지금 설정할게요
            </button>
            <button onClick={() => dismiss(false)} style={{
              width: '100%', padding: '11px', borderRadius: 14,
              background: '#f3f4f6', color: '#6b7280', fontSize: 14,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              나중에
            </button>
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
              background: 'var(--color-primary, #6B1E2E)',
              color: 'white', fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              다음 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

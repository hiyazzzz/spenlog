'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Step {
  title: string
  desc: string
  // 하이라이트 영역 (viewport 기준, null = AI 입력창)
  highlight: 'ai' | 'nav-0' | 'nav-1' | 'nav-2' | 'nav-3'
  isFinal?: boolean
}

const STEPS: Step[] = [
  {
    title: '여기서 지출을 기록해요',
    desc: "'스타벅스 육천원 카드' 한 줄이면\nAI가 자동으로 분류해줘요!",
    highlight: 'ai',
  },
  {
    title: '홈에서 한눈에 확인',
    desc: '이번 달 지출 현황과\n예산 달성률을 볼 수 있어요',
    highlight: 'nav-0',
  },
  {
    title: '리포트로 패턴 파악',
    desc: '월간 소비 패턴을 보고\nAI와 함께 다음 달을 계획해요',
    highlight: 'nav-2',
  },
  {
    title: '자산을 한 곳에서 관리',
    desc: '계좌·카드·고정비를\n모두 연결해 관리할 수 있어요',
    highlight: 'nav-3',
    isFinal: true,
  },
]

interface Props {
  userId: string
}

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

  // BottomNav: 5개 아이템, 각 20% 너비 (0=홈, 1=분석, 2=리포트, 3=자산, 4=설정)
  function getNavHighlight(idx: number) {
    return {
      position: 'fixed' as const,
      bottom: 0,
      left: `${idx * 20}%`,
      width: '20%',
      height: 64,
      borderRadius: '12px 12px 0 0',
    }
  }

  function getHighlightStyle() {
    if (current.highlight === 'ai') {
      return {
        position: 'fixed' as const,
        bottom: 68,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 420px)',
        height: 110,
        borderRadius: 20,
      }
    }
    const navIdx = parseInt(current.highlight.split('-')[1])
    return getNavHighlight(navIdx)
  }

  const hlStyle = getHighlightStyle()
  const isAboveNav = current.highlight === 'ai'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* 어두운 오버레이 — box-shadow 컷아웃으로 하이라이트 영역만 밝게 */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.65)',
        pointerEvents: 'none',
      }} />

      {/* 하이라이트 영역 (오버레이 위에 밝게) */}
      <div style={{
        ...hlStyle,
        background: 'rgba(255,255,255,0.15)',
        outline: '2.5px solid rgba(255,255,255,0.7)',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.65)',
        pointerEvents: 'none',
      }} />

      {/* 스텝 카운터 + 건너뛰기 */}
      <div style={{
        position: 'fixed', top: 16, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '0 20px', zIndex: 10000,
      }}>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600 }}>
          {step + 1}/{STEPS.length}
        </span>
        <button onClick={() => dismiss(false)} style={{
          background: 'rgba(255,255,255,0.2)', border: '1px solid rgba(255,255,255,0.3)',
          color: 'white', fontSize: 13, padding: '6px 14px', borderRadius: 20,
          cursor: 'pointer', fontFamily: 'inherit', backdropFilter: 'blur(4px)',
        }}>
          건너뛰기
        </button>
      </div>

      {/* 도트 인디케이터 */}
      <div style={{
        position: 'fixed', top: 56, left: 0, right: 0,
        display: 'flex', justifyContent: 'center', gap: 6, zIndex: 10000,
      }}>
        {STEPS.map((_, i) => (
          <div key={i} style={{
            width: i === step ? 20 : 6, height: 6, borderRadius: 3,
            background: i === step ? 'white' : 'rgba(255,255,255,0.35)',
            transition: 'all 0.25s',
          }} />
        ))}
      </div>

      {/* 말풍선 카드 */}
      <div style={{
        position: 'fixed',
        ...(isAboveNav
          ? { bottom: 210, left: '50%', transform: 'translateX(-50%)' }
          : { bottom: 80, left: '50%', transform: 'translateX(-50%)' }),
        width: 'min(calc(100% - 40px), 340px)',
        background: 'white', borderRadius: 20,
        padding: '20px 22px', zIndex: 10000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
      }}>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 8 }}>
          {current.title}
        </h3>
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6, marginBottom: 16, whiteSpace: 'pre-line' }}>
          {current.desc}
        </p>

        {isLast ? (
          /* 마지막 스텝: 자산 설정 CTA */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 4, lineHeight: 1.5 }}>
              지금 자산을 입력하면{'\n'}가계부 초기 설정이 완성돼요! 🎯
            </p>
            <button onClick={() => dismiss(true)} style={{
              width: '100%', padding: '12px', borderRadius: 12,
              background: 'var(--color-primary, #6B1E2E)',
              color: 'white', fontSize: 14, fontWeight: 700,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              지금 설정할게요
            </button>
            <button onClick={() => dismiss(false)} style={{
              width: '100%', padding: '10px', borderRadius: 12,
              background: '#f3f4f6', color: '#6b7280', fontSize: 14,
              border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>
              나중에
            </button>
          </div>
        ) : (
          /* 일반 스텝: 다음 버튼 */
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {step > 0 ? (
              <button onClick={() => setStep(s => s - 1)} style={{
                background: 'none', border: 'none', color: '#9ca3af',
                fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>← 이전</button>
            ) : <div />}
            <button onClick={() => setStep(s => s + 1)} style={{
              padding: '10px 24px', borderRadius: 12,
              background: 'var(--color-primary, #6B1E2E)',
              color: 'white', fontSize: 14, fontWeight: 600,
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

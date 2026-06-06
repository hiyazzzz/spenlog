'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Step {
  title: string
  desc: string
  highlight: 'ai' | 'nav-0' | 'nav-1' | 'nav-2' | 'nav-3'
  isFinal?: boolean
}

const STEPS: Step[] = [
  {
    title: '여기서 지출을 기록해요',
    desc: '"스타벅스 육천원 카드" 한 줄이면\nAI가 자동으로 분류해줘요!',
    highlight: 'ai',
  },
  {
    title: '홈에서 한눈에 확인',
    desc: '이번 달 지출 현황과\n예산 달성률을 볼 수 있어요',
    highlight: 'nav-0',
  },
  {
    title: '내역에서 기록 확인',
    desc: '모든 수입·지출 내역을\n날짜·카테고리별로 확인해요',
    highlight: 'nav-1',
  },
  {
    title: '리포트로 패턴 파악',
    desc: '월간 소비 패턴을 보고\nAI와 함께 다음 달을 계획해요',
    highlight: 'nav-3',
  },
  {
    title: '자산을 한 곳에서 관리',
    desc: '계좌·카드·고정비를\n모두 연결해 관리할 수 있어요',
    highlight: 'nav-2',
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
    await supabase.from('users').upsert({ id: userId, guide_completed: true }, { onConflict: 'id' })
    if (goAssets) router.push('/assets')
    else router.refresh()
  }

  if (!visible) return null

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1
  const isAI = current.highlight === 'ai'

  // 하이라이트 박스 위치 계산
  function getHighlightStyle(): React.CSSProperties {
    if (isAI) {
      // AI 입력박스: 커버배너(~180px) + 상단바(56px) 아래 = top ~246px
      // 섹션 타이틀 + 박스 전체 높이 ~120px
      return {
        position: 'fixed',
        top: 246,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'min(calc(100% - 32px), 420px)',
        height: 120,
        borderRadius: 18,
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

  // 화살표: 팝업 → 하이라이트 방향
  // AI: 팝업이 화면 중앙(~50%), 하이라이트가 top ~246px → 화살표는 팝업 위쪽
  // nav: 팝업이 화면 중앙, 하이라이트가 바텀 → 화살표는 팝업 아래쪽
  const arrowPointsUp = isAI   // 하이라이트가 팝업보다 위에 있으면 화살표 위로
  const arrowPointsDown = !isAI // 하이라이트가 팝업보다 아래에 있으면 화살표 아래로

  // 화살표 SVG
  function Arrow({ up }: { up: boolean }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: up ? 0 : 0, marginTop: up ? 0 : 0 }}>
        <svg width="32" height="52" viewBox="0 0 32 52" fill="none">
          {up ? (
            // 위를 가리키는 손글씨 화살표
            <path
              d="M16 48 C14 36, 18 24, 16 8 M16 8 L9 18 M16 8 L23 18"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
            />
          ) : (
            // 아래를 가리키는 손글씨 화살표
            <path
              d="M16 4 C14 16, 18 28, 16 44 M16 44 L9 34 M16 44 L23 34"
              stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}
            />
          )}
        </svg>
      </div>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999 }}>
      {/* 전체 다크 오버레이 */}
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', pointerEvents: 'none' }} />

      {/* 하이라이트 컷아웃 */}
      <div style={{
        ...hlStyle,
        background: 'rgba(255,255,255,0.12)',
        outline: '3px solid rgba(255,255,255,0.9)',
        boxShadow: '0 0 0 9999px rgba(0,0,0,0.72), 0 0 28px rgba(255,255,255,0.25)',
        pointerEvents: 'none',
        zIndex: 1,
      }} />

      {/* 상단: 스텝 카운터 + 건너뛰기 */}
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
        }}>건너뛰기</button>
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

      {/* 중앙 팝업 + 화살표 */}
      <div style={{
        position: 'fixed',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(calc(100% - 40px), 340px)',
        zIndex: 10001,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        {/* 위 화살표 (AI 하이라이트: 팝업보다 위) */}
        {arrowPointsUp && (
          <div style={{ marginBottom: 4, alignSelf: 'center' }}>
            <Arrow up={true} />
          </div>
        )}

        {/* 말풍선 카드 */}
        <div style={{
          width: '100%',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(12px)',
          borderRadius: 22,
          padding: '22px 24px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.3)',
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
              }}>지금 설정할게요</button>
              <button onClick={() => dismiss(false)} style={{
                width: '100%', padding: '11px', borderRadius: 14,
                background: '#f3f4f6', color: '#6b7280', fontSize: 14,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
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
                background: 'var(--color-primary, #6B1E2E)',
                color: 'white', fontSize: 14, fontWeight: 700,
                border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              }}>다음 →</button>
            </div>
          )}
        </div>

        {/* 아래 화살표 (nav 하이라이트: 팝업보다 아래) */}
        {arrowPointsDown && (
          <div style={{ marginTop: 4, alignSelf: 'center' }}>
            <Arrow up={false} />
          </div>
        )}
      </div>
    </div>
  )
}

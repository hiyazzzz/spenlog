'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import type { Theme } from '@/types'

type Step = 'intro' | 'name' | 'theme' | 'finance' | 'welcome'


const INTRO_SLIDES = [
  {
    emoji: '🤖',
    title: '"스타벅스 육천원 카드" 한 줄이면',
    desc: 'AI가 금액·카테고리·결제수단을 자동으로 분류해줘요',
    bg: 'linear-gradient(135deg, #6B1E2E 0%, #9B2C45 100%)',
  },
  {
    emoji: '📊',
    title: '이번 달 지출 현황을 한눈에',
    desc: '카테고리별 예산 달성률을 대시보드에서 바로 확인해요',
    bg: 'linear-gradient(135deg, #4A7541 0%, #6AAD5E 100%)',
  },
  {
    emoji: '🏦',
    title: '계좌·카드·고정비 연결하면',
    desc: '루틴 기록 한 번으로 잔액이 자동으로 반영돼요',
    bg: 'linear-gradient(135deg, #5C4B8A 0%, #7B6AAD 100%)',
  },
]

const RANDOM_NAMES = [
  '데굴데굴 도토리', '반짝반짝 별님', '폴짝폴짝 토끼',
  '살금살금 고양이', '두근두근 하트', '알뜰살뜰 다람쥐',
  '포근포근 구름', '도란도란 물방울', '사뿐사뿐 나비',
  '쏙쏙 솔방울', '통통 밤톨', '깜짝깜짝 별똥별',
]

const THEME_LIST: { key: Theme; emoji: string; premium?: boolean }[] = [
  { key: 'Burgundy', emoji: '🩷' },
  { key: 'Sage', emoji: '🩷' },
  { key: 'Lavender', emoji: '🩷', premium: true },
  { key: 'Terracotta', emoji: '🩷', premium: true },
]

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
}

function formatWon(val: string) {
  const n = val.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '36px', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            flex: 1, height: '4px', borderRadius: '2px',
            background: i <= current ? color : '#EDE3E5',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>
      <span style={{ fontSize: '12px', color: '#C4A0A8', marginLeft: '10px', whiteSpace: 'nowrap' as const }}>
        {current + 1}/{total}
      </span>
    </div>
  )
}

interface Props { userId: string; email: string }

export default function OnboardingForm({ userId, email }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('intro')
  const [introSlide, setIntroSlide] = useState(0)
  const [name, setName] = useState('')
  const [suggestedName, setSuggestedName] = useState(randomName)
  const [theme, setTheme] = useState<Theme>('Burgundy')
  const [income, setIncome] = useState('')
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPremiumSheet, setShowPremiumSheet] = useState(false)

  useEffect(() => {
    const t = THEMES[theme]
    const root = document.documentElement
    root.style.setProperty('--color-primary', t.primary)
    root.style.setProperty('--color-primary-mid', t.primaryMid)
    root.style.setProperty('--color-primary-light', t.primaryLight)
    root.style.setProperty('--color-accent', t.accent)
    root.style.setProperty('--color-bg', t.bg)
    document.body.style.background = t.bg
  }, [theme])

  const primary = THEMES[theme].primary
  const primaryLight = THEMES[theme].primaryLight

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '16px', borderRadius: '16px',
    border: '1.5px solid ' + primaryLight, background: '#fff',
    fontSize: '16px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  async function handleFinish() {
    setSaving(true)
    const incomeVal = parseInt(income.replace(/,/g, '')) * 10000 || 0
    const goalVal = parseInt(goal.replace(/,/g, '')) * 10000 || 0
    const finalName = name.trim() || suggestedName
    const { error: err } = await supabase.from('users').upsert({
      id: userId, email, name: finalName,
      income: incomeVal, saving_goal: goalVal,
      theme, onboarding_completed: true,
    })
    if (err) { setError('저장 오류: ' + err.message); setSaving(false); return }
    setStep('welcome')
    setTimeout(() => router.push('/'), 2000)
  }

  if (step === 'intro') {
    const slide = INTRO_SLIDES[introSlide]
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* 건너뛰기 */}
        <button onClick={() => setStep('name')} style={{
          position: 'absolute', top: 16, right: 20, zIndex: 10,
          background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20,
          padding: '6px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit',
        }}>건너뛰기</button>

        {/* 슬라이드 영역 */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '60px 32px 40px',
          background: slide.bg, minHeight: '65vh',
        }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>{slide.emoji}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 1.3 }}>
            {slide.title}
          </h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.6 }}>
            {slide.desc}
          </p>
        </div>

        {/* 하단 컨트롤 */}
        <div style={{ padding: '24px 24px 48px', background: '#fff' }}>
          {/* 페이지 인디케이터 */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {INTRO_SLIDES.map((_, i) => (
              <div key={i} style={{
                width: i === introSlide ? 20 : 6, height: 6, borderRadius: 3,
                background: i === introSlide ? 'var(--color-primary)' : '#e5e7eb',
                transition: 'all 0.3s',
              }} />
            ))}
          </div>

          {introSlide < INTRO_SLIDES.length - 1 ? (
            <button onClick={() => setIntroSlide(s => s + 1)} style={{
              width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--color-primary)',
              color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>다음 →</button>
          ) : (
            <button onClick={() => setStep('name')} style={{
              width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--color-primary)',
              color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>시작하기 🎉</button>
          )}
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={1} total={4} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>
          안녕하세요! 😊
        </h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>어떻게 불러드릴까요?</p>
        <div style={{ background: primaryLight, borderRadius: '16px', padding: '20px', marginBottom: '16px', textAlign: 'center' as const }}>
          <p style={{ fontSize: '22px', fontWeight: '700', color: primary, marginBottom: '12px' }}>{suggestedName}</p>
          <button onClick={() => setSuggestedName(randomName())} style={{
            padding: '8px 18px', borderRadius: '20px', border: '1.5px solid ' + primary,
            background: 'white', color: primary, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>🔀 다른 이름</button>
        </div>
        <p style={{ fontSize: '13px', color: '#B8A8AC', marginBottom: '8px' }}>또는 직접 입력</p>
        <input type="text" placeholder="닉네임 입력 (선택)" value={name}
          onChange={e => setName(e.target.value)} maxLength={12} style={inputStyle} />
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '6px' }}>
          입력하지 않으면 "{suggestedName}"으로 시작해요
        </p>
        <div style={{ marginTop: '32px' }}>
          <button onClick={() => setStep('theme')} style={{
            width: '100%', padding: '16px', borderRadius: '16px', background: primary,
            color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>다음 →</button>
        </div>
      </div>
    )
  }

  if (step === 'theme') {
    return (
      <>
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={2} total={4} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>나만의 감성을 골라봐요 🎨</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>언제든지 설정에서 바꿀 수 있어요</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          {THEME_LIST.map(({ key, emoji, premium }) => {
            const t = THEMES[key]
            const selected = theme === key
            return (
              <button key={key}
                onClick={() => setTheme(key)}
                style={{
                  padding: '20px 16px', borderRadius: '20px',
                  border: selected ? '2.5px solid ' + t.primary : '2px solid transparent',
                  background: selected ? t.primaryLight : '#fff',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px',
                  transition: 'all 0.15s',
                  position: 'relative' as const,
                }}>
                <div style={{ width: '100%', height: '40px', borderRadius: '10px', background: t.primary }} />
                {premium && (
                  <span style={{ position: 'absolute' as const, top: 6, right: 8, fontSize: 14 }}>💎</span>
                )}
                <span style={{ fontSize: '20px' }}>{emoji}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: premium ? '#9ca3af' : t.primary }}>{t.name}</span>
                {selected && !premium && <span style={{ fontSize: '16px' }}>✓</span>}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          <button
            onClick={() => {
              const isPremium = THEME_LIST.find(t => t.key === theme)?.premium
              if (isPremium) { setShowPremiumSheet(true) } else { setStep('finance') }
            }}
            style={{
              width: '100%', padding: '16px', borderRadius: '16px', background: primary,
              color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>다음 →</button>
          <button onClick={() => setStep('name')} style={{
            background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>← 이전</button>
        </div>
      </div>

      {/* 프리미엄 Bottom Sheet */}
      {showPremiumSheet && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}>
          <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px' }}>
            <p style={{ fontSize: 22, textAlign: 'center', marginBottom: 8 }}>💎</p>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>프리미엄 전용 테마예요</p>
            <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>
              지금 업그레이드하면 모든 테마를<br />자유롭게 사용할 수 있어요
            </p>
            <button onClick={() => { setShowPremiumSheet(false); router.push('/premium') }}
              style={{ width: '100%', padding: '14px', borderRadius: 14, background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: 10 }}>
              프리미엄 시작하기
            </button>
            <button onClick={() => { setTheme('Burgundy'); setShowPremiumSheet(false); setStep('finance') }}
              style={{ width: '100%', padding: '12px', borderRadius: 14, background: '#f3f4f6', color: '#6b7280', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
              기본 테마로 계속
            </button>
          </div>
        </div>
      )}
      </>
    )
  }

  if (step === 'finance') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={3} total={4} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>한 달 살림을 알려줘요 💰</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>예산 관리의 기준이 돼요. 나중에 바꿀 수 있어요.</p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '16px', marginBottom: '8px' }}>
          <div>
            <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>월 수입 (세후)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="text" inputMode="numeric" placeholder="300"
                value={income}
                onChange={e => setIncome(formatWon(e.target.value))}
                style={{ ...inputStyle, flex: 1 }} autoFocus />
              <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
            </div>
            {income && (
              <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>
                = ₩{(parseInt(income.replace(/,/g, '')) * 10000).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>
              저축 목표 <span style={{ fontWeight: '400', color: '#C4A0A8' }}>(선택)</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <input type="text" inputMode="numeric" placeholder="50"
                value={goal}
                onChange={e => setGoal(formatWon(e.target.value))}
                style={{ ...inputStyle, flex: 1 }} />
              <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
            </div>
            {goal && (
              <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>
                = ₩{(parseInt(goal.replace(/,/g, '')) * 10000).toLocaleString()}
              </p>
            )}
            <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '6px' }}>💡 입력하면 저축 달성률을 볼 수 있어요</p>
          </div>
        </div>
        {error && <p style={{ fontSize: '13px', color: '#E05070', marginTop: '8px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '28px' }}>
          <button onClick={handleFinish} disabled={saving} style={{
            width: '100%', padding: '16px', borderRadius: '16px',
            background: saving ? '#C4A0A8' : primary,
            color: '#fff', fontSize: '15px', fontWeight: '600',
            border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
          }}>{saving ? '저장 중...' : '시작하기 →'}</button>
          <button onClick={() => { if (!saving) handleFinish() }} disabled={saving} style={{
            background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>건너뛰기</button>
          <button onClick={() => setStep('theme')} style={{
            background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit',
          }}>← 이전</button>
        </div>
      </div>
    )
  }

  const finalName = name.trim() || suggestedName
  return (
    <div style={{
      maxWidth: 420, margin: '0 auto', padding: '0 24px',
      display: 'flex', flexDirection: 'column' as const, alignItems: 'center',
      justifyContent: 'center', minHeight: '60vh', textAlign: 'center' as const,
    }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🌿</div>
      <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '12px' }}>{finalName}님,</h1>
      <p style={{ fontSize: '18px', fontWeight: '600', color: primary, marginBottom: '8px' }}>Spenlog가 준비됐어요!</p>
      <p style={{ fontSize: '15px', color: '#B8A8AC', lineHeight: 1.6 }}>오늘부터 소비를 기록해봐요.</p>
    </div>
  )
}

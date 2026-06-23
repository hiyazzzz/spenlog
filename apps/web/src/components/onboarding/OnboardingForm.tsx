'use client'
import { TEXTS } from '@/config/texts'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import type { Theme } from '@spenlog/types'
import dayjs from 'dayjs'

type Step = 'intro' | 'name' | 'theme' | 'income' | 'goal' | 'welcome'

const INTRO_SLIDES = [
  { emoji: '🤖', title: '"스타벅스 육천원 카드" 한 줄이면', desc: 'AI가 금액·카테고리·결제수단을 자동으로 분류해줘요', bg: 'linear-gradient(135deg, #6B1E2E 0%, #9B2C45 100%)' },
  { emoji: '📊', title: '이번 달 지출 현황을 한눈에', desc: '카테고리별 예산 달성률을 대시보드에서 바로 확인해요', bg: 'linear-gradient(135deg, #4A7541 0%, #6AAD5E 100%)' },
  { emoji: '🏦', title: '계좌·카드·고정비 연결하면', desc: '루틴 기록 한 번으로 잔액이 자동으로 반영돼요', bg: 'linear-gradient(135deg, #5C4B8A 0%, #7B6AAD 100%)' },
]

const RANDOM_NAMES = ['데굴데굴 도토리','반짝반짝 별님','폴짝폴짝 토끼','살금살금 고양이','두근두근 하트','알뜨살뜨 다람쥐','포근포근 구름','도란도란 물방울','사블사블 나비','속속 솔방울','통통 밤톨','꺜짝꺜짝 별동별']

const THEME_LIST: { key: Theme; premium?: boolean }[] = [
  { key: 'Burgundy' },
  { key: 'Sage' },
]

const DEFAULT_CATS = ['생활비','고정비','활동비','수입']
const TOTAL_STEPS = 4

function randomName() { return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)] }
function formatWon(val: string) { const n = val.replace(/[^0-9]/g, ''); return n ? Number(n).toLocaleString() : '' }
function parseMan(val: string) { return (parseFloat(val.replace(/,/g, '')) || 0) * 10000 }

function ProgressBar({ current, total, color }: { current: number; total: number; color: string }) {
  return (
    <div style={{ display: 'flex', gap: '6px', marginBottom: '36px', alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: '6px', flex: 1 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i <= current ? color : '#EDE3E5', transition: 'background 0.3s' }} />
        ))}
      </div>
      <span style={{ fontSize: '12px', color: '#C4A0A8', marginLeft: '10px', whiteSpace: 'nowrap' as const }}>{current + 1}/{total}</span>
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
  const [showPremiumSheet, setShowPremiumSheet] = useState(false)
  const [income, setIncome] = useState('')
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

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

  // overrideGoal: 건너뛰기 시 goal을 빈값으로 처리
  async function handleFinish(overrideGoal?: string) {
    setSaving(true); setError('')
    try {
      const finalName = name.trim() || suggestedName
      const month = dayjs().format('YYYY-MM')
      const incomeNum = parseMan(income)
      const goalNum = parseMan(overrideGoal !== undefined ? overrideGoal : goal)
      const emailToUse = email || `${userId}@guest.spenlog.app`
      const { error: uErr } = await supabase.from('users').upsert(
        { id: userId, email: emailToUse, name: finalName, income: incomeNum, saving_goal: goalNum, theme, onboarding_completed: true, init_setup_completed: true },
        { onConflict: 'id' }
      )
      if (uErr) throw uErr
      if (typeof window !== 'undefined') {
        localStorage.setItem('spenlog_theme', theme)
        localStorage.setItem('spenlog_init_setup_completed', 'true')
      }
      // 수입 기반 자동 예산 분배: 생활비 40% / 고정비 35% / 활동비 25%
      const budgetBase = Math.max(incomeNum - goalNum, 0)
      if (budgetBase > 0) {
        const dist: Record<string, number> = { '생활비': 0.40, '고정비': 0.35, '활동비': 0.25 }
        const rows = Object.entries(dist).map(([category, ratio]) => ({
          user_id: userId, category,
          amount: Math.round(budgetBase * ratio / 1000) * 1000,
          month, source: 'manual',
        }))
        await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category,month' })
      }
      const { data: existingCats } = await supabase.from('categories').select('id').eq('user_id', userId).limit(1)
      if (!existingCats?.length) {
        await supabase.from('categories').insert(
          DEFAULT_CATS.map((n, i) => ({ user_id: userId, name: n, is_default: true, is_hidden: false, sort_order: i }))
        )
      }
      setStep('welcome')
      setTimeout(() => router.push('/'), 2500)
    } catch (e: any) { setError(TEXTS.onboarding.errSave(e.message)); setSaving(false) }
  }

  if (step === 'intro') {
    const slide = INTRO_SLIDES[introSlide]
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        <button onClick={() => setStep('name')} style={{ position: 'absolute', top: 16, right: 20, zIndex: 10, background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 32px 40px', background: slide.bg, minHeight: '65vh' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>{slide.emoji}</div>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: '#fff', textAlign: 'center', marginBottom: 12, lineHeight: 1.3 }}>{slide.title}</h2>
          <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.85)', textAlign: 'center', lineHeight: 1.6 }}>{slide.desc}</p>
        </div>
        <div style={{ padding: '24px 24px 48px', background: '#fff' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 24 }}>
            {INTRO_SLIDES.map((_, i) => (<div key={i} style={{ width: i === introSlide ? 20 : 6, height: 6, borderRadius: 3, background: i === introSlide ? 'var(--color-primary)' : '#e5e7eb', transition: 'all 0.3s' }} />))}
          </div>
          {introSlide < INTRO_SLIDES.length - 1
            ? <button onClick={() => setIntroSlide(s => s + 1)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--color-primary)', color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnNext}</button>
            : <button onClick={() => setStep('name')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--color-primary)', color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>시작하기 🎉</button>
          }
        </div>
      </div>
    )
  }

  if (step === 'name') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={0} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>{TEXTS.onboarding.nameTitle}</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>{TEXTS.onboarding.nameSubtitle}</p>
        <div style={{ background: primaryLight, borderRadius: '16px', padding: '20px', marginBottom: '16px', textAlign: 'center' as const }}>
          <p style={{ fontSize: '22px', fontWeight: '700', color: primary, marginBottom: '12px' }}>{suggestedName}</p>
          <button onClick={() => setSuggestedName(randomName())} style={{ padding: '8px 18px', borderRadius: '20px', border: '1.5px solid ' + primary, background: 'white', color: primary, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.nameBtnShuffle}</button>
        </div>
        <p style={{ fontSize: '13px', color: '#B8A8AC', marginBottom: '8px' }}>{TEXTS.onboarding.nameOrLabel}</p>
        <input type="text" placeholder={TEXTS.onboarding.nameInputPh} value={name} onChange={e => setName(e.target.value)} maxLength={12} style={inputStyle} />
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '6px' }}>{TEXTS.onboarding.nameDefaultHint(suggestedName)}</p>
        <div style={{ marginTop: '32px' }}>
          <button onClick={() => setStep('theme')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnNext}</button>
        </div>
      </div>
    )
  }

  if (step === 'theme') {
    return (
      <>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
          <ProgressBar current={1} total={TOTAL_STEPS} color={primary} />
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>{TEXTS.onboarding.themeTitle}</h1>
          <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>{TEXTS.onboarding.themeSubtitle}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            {THEME_LIST.map(({ key, premium }) => {
              const t = THEMES[key]
              const selected = theme === key
              return (
                <button key={key} onClick={() => setTheme(key)} style={{ padding: '16px', borderRadius: '20px', border: selected ? '2.5px solid ' + t.primary : '2px solid transparent', background: selected ? t.primaryLight : '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: '8px', transition: 'all 0.15s', position: 'relative' as const }}>
                  <div style={{ width: '100%', height: '56px', borderRadius: '12px', background: t.primary, position: 'relative' as const }}>
                    {selected && <div style={{ position: 'absolute', bottom: 6, right: 8, width: 16, height: 16, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>✓</div>}
                  </div>
                  {premium && <span style={{ position: 'absolute' as const, top: 6, right: 8, fontSize: 14 }}>💎</span>}
                  <span style={{ fontSize: '13px', fontWeight: '700', color: selected ? t.primary : '#374151' }}>{t.name}</span>
                </button>
              )
            })}
          </div>
          <p style={{ fontSize: 12, color: '#B8A8AC', textAlign: 'center' as const, marginBottom: 24 }}>{TEXTS.onboarding.themeMoreNote}</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            <button onClick={async () => {
              await supabase.from('users').upsert({ id: userId, email: email || `${userId}@guest.spenlog.app`, onboarding_completed: true }, { onConflict: 'id' })
              if (typeof window !== 'undefined') localStorage.setItem('spenlog_onboarding_completed', 'true')
              setStep('income')
            }} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
            <button onClick={() => setStep('name')} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnPrev}</button>
          </div>
        </div>
        {showPremiumSheet && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px' }}>
              <p style={{ fontSize: 22, textAlign: 'center', marginBottom: 8 }}>💎</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>{TEXTS.onboarding.themePremiumTitle}</p>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>{TEXTS.onboarding.themePremiumDesc}</p>
              <button onClick={async () => {
                setTheme('Burgundy'); setShowPremiumSheet(false)
                await supabase.from('users').upsert({ id: userId, email: email || `${userId}@guest.spenlog.app`, onboarding_completed: true }, { onConflict: 'id' })
                if (typeof window !== 'undefined') localStorage.setItem('spenlog_onboarding_completed', 'true')
                setStep('income')
              }} style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#f3f4f6', color: '#6b7280', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.themeBtnDefault}</button>
            </div>
          </div>
        )}
      </>
    )
  }

  if (step === 'income') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={2} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>{TEXTS.onboarding.incomeTitle}</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>{TEXTS.onboarding.incomeSubtitle}</p>
        <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>{TEXTS.onboarding.incomeLabel}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="text" inputMode="numeric" placeholder="300" value={income} onChange={e => setIncome(formatWon(e.target.value))} style={{ ...inputStyle, flex: 1 }} autoFocus />
          <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
        </div>
        {income && <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>{TEXTS.onboarding.incomeHint(parseMan(income))}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '32px' }}>
          <button onClick={() => setStep('goal')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={() => { setIncome(''); setStep('goal') }} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnSkip}</button>
          <button onClick={() => setStep('theme')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnPrev}</button>
        </div>
      </div>
    )
  }

  if (step === 'goal') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={3} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>{TEXTS.onboarding.goalTitle}</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>{TEXTS.onboarding.goalSubtitle}</p>
        <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>{TEXTS.onboarding.goalLabel} <span style={{ fontWeight: '400', color: '#C4A0A8' }}>{TEXTS.onboarding.goalLabelOpt}</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="text" inputMode="numeric" placeholder="50" value={goal} onChange={e => setGoal(formatWon(e.target.value))} style={{ ...inputStyle, flex: 1 }} autoFocus />
          <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
        </div>
        {goal && <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>{TEXTS.onboarding.goalHint(parseMan(goal))}</p>}
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '8px' }}>{TEXTS.onboarding.goalTip}</p>
        {error && <p style={{ fontSize: '13px', color: '#E05070', marginTop: '8px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '32px' }}>
          <button onClick={() => handleFinish()} disabled={saving} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: saving ? '#C4A0A8' : primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>{saving ? TEXTS.onboarding.btnStartSaving : '시작하기 🎉'}</button>
          <button onClick={() => handleFinish('')} disabled={saving} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('income')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.onboarding.btnPrev}</button>
        </div>
      </div>
    )
  }

  const finalName = name.trim() || suggestedName
  return (
    <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' as const }}>
      <div style={{ fontSize: '64px', marginBottom: '24px' }}>🌿</div>
      <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '12px' }}>{finalName}{TEXTS.onboarding.completeSuffix}</h1>
      <p style={{ fontSize: '18px', fontWeight: '600', color: primary, marginBottom: '8px' }}>{TEXTS.onboarding.completeTitle}</p>
      <p style={{ fontSize: '15px', color: '#B8A8AC', lineHeight: 1.6, marginBottom: '20px' }}>{TEXTS.onboarding.completeSubtitle}</p>
      <p style={{ fontSize: '13px', color: '#9A7A80', background: primaryLight, borderRadius: '12px', padding: '12px 16px', lineHeight: 1.6 }}>
        🏦 계좌·카드·고정비는 <strong>자산 탭</strong>에서 설정할 수 있어요
      </p>
    </div>
  )
}

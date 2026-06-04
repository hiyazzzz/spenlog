'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import type { Theme } from '@/types'

type Step = 'name' | 'theme' | 'finance' | 'welcome'

const RANDOM_NAMES = [
  '데굴데굴 도토리', '반짝반짝 별님', '폴짝폴짝 토끼',
  '살금살금 고양이', '두근두근 하트', '알뜰살뜰 다람쥐',
  '포근포근 구름', '도란도란 물방울', '사뿐사뿐 나비',
  '쏙쏙 솔방울', '통통 밤톨', '깜짝깜짝 별똥별',
]

const THEME_LIST: { key: Theme; emoji: string; desc: string }[] = [
  { key: 'Burgundy', emoji: '🍷', desc: '고급스러운' },
  { key: 'Sage', emoji: '🌿', desc: '자연스러운' },
  { key: 'Lavender', emoji: '💜', desc: '감성적인' },
  { key: 'Terracotta', emoji: '🧡', desc: '따뜻한' },
]

function randomName() {
  return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)]
}

function formatWon(val: string) {
  const n = val.replace(/[^0-9]/g, '')
  return n ? Number(n).toLocaleString() : ''
}

interface Props { userId: string; email: string }

export default function OnboardingForm({ userId, email }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const [step, setStep] = useState<Step>('name')
  const [name, setName] = useState('')
  const [suggestedName, setSuggestedName] = useState(randomName)
  const [theme, setTheme] = useState<Theme>('Burgundy')
  const [income, setIncome] = useState('')
  const [goal, setGoal] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // 테마 즉시 미리보기
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

  const STEP_ORDER: Step[] = ['name', 'theme', 'finance', 'welcome']
  const stepIdx = STEP_ORDER.indexOf(step)

  const primary = THEMES[theme].primary
  const primaryLight = THEMES[theme].primaryLight

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '16px', borderRadius: '16px',
    border: `1.5px solid ${primaryLight}`, background: '#fff',
    fontSize: '16px', color: '#3D2020', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }

  async function handleFinish() {
    setSaving(true)
    const incomeVal = parseInt(income.replace(/,/g, '')) * 10000 || 0
    const goalVal = parseInt(goal.replace(/,/g, '')) * 10000 || 0
    const finalName = name.trim() || suggestedName

    const { error: err } = await supabase.from('users').upsert({
      id: userId,
      email,
      name: finalName,
      income: incomeVal,
      saving_goal: goalVal,
      theme,
      onboarding_completed: true,
    })
    if (err) { setError('저장 오류: ' + err.message); setSaving(false); return }
    setStep('welcome')
    setTimeout(() => router.push('/'), 2000)
  }

  // ── Step: 이름 설정 ──
  if (step === 'name') {
    const displayName = name.trim() || suggestedName
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={0} total={3} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>
          안녕하세요! 😊
        </h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>
          어떻게 불러드릴까요?
        </p>

        {/* 랜덤 닉네임 추천 */}
        <div style={{
          background: primaryLight, borderRadius: '16px',
          padding: '20px', marginBottom: '16px', textAlign: 'center',
        }}>
          <p style={{ fontSize: '22px', fontWeight: '700', color: primary, marginBottom: '12px' }}>
            {suggestedName}
          </p>
          <button onClick={() => setSuggestedName(randomName())} style={{
            padding: '8px 18px', borderRadius: '20px',
            border: `1.5px solid ${primary}`, background: 'white',
            color: primary, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            🔀 다른 이름
          </button>
        </div>

        {/* 직접 입력 */}
        <p style={{ fontSize: '13px', color: '#B8A8AC', marginBottom: '8px' }}>또는 직접 입력</p>
        <input
          type="text" placeholder="닉네임 입력 (선택)"
          value={name} onChange={e => setName(e.target.value)}
          maxLength={12} style={inputStyle}
        />
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '6px' }}>
          입력하지 않으면 "{suggestedName}"으로 시작해요
        </p>

        <div style={{ marginTop: '32px' }}>
          <button onClick={() => setStep('theme')} style={{
            width: '100%', padding: '16px', borderRadius: '16px',
            background: primary, color: '#fff', fontSize: '15px',
            fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            다음 →
          </button>
        </div>
      </div>
    )
  }

  // ── Step: 테마 선택 ──
  if (step === 'theme') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={1} total={3} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>
          나만의 감성을 골라봐요 🎨
        </h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>
          언제든지 설정에서 바꿀 수 있어요
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '32px' }}>
          {THEME_LIST.map(({ key, emoji, desc }) => {
            const t = THEMES[key]
            const selected = theme === key
            return (
              <button key={key} onClick={() => setTheme(key)} style={{
                padding: '20px 16px', borderRadius: '20px',
                border: selected ? `2.5px solid ${t.primary}` : '2px solid transparent',
                background: selected ? t.primaryLight : '#fff',
                boxShadow: selected ? `0 0 0 1px ${t.primary}20` : '0 1px 4px rgba(0,0,0,0.06)',
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                transition: 'all 0.15s',
              }}>
                {/* 컬러 스와치 */}
                <div style={{
                  width: '100%', height: '40px', borderRadius: '10px',
                  background: t.primary,
                }} />
                <span style={{ fontSize: '20px' }}>{emoji}</span>
                <span style={{ fontSize: '13px', fontWeight: '700', color: t.primary }}>{t.name}</span>
                <span style={{ fontSize: '11px', color: '#9ca3af' }}>{desc}</span>
                {selected && <span style={{ fontSize: '16px' }}>✓</span>}
              </button>
            )
          })}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
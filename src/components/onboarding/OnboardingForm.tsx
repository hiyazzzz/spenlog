'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { THEMES } from '@/lib/themes'
import type { Theme } from '@/types'
import dayjs from 'dayjs'

type Step = 'intro' | 'name' | 'theme' | 'income' | 'goal' | 'budget' | 'assets' | 'cards' | 'fixedcosts' | 'categories' | 'welcome'
type FixedKind = '고정지출' | '고정저축'

const INTRO_SLIDES = [
  { emoji: '\u{1F916}', title: '"스타벅스 육천원 카드" 한 줄이면', desc: 'AI가 금액·카테고리·결제수단을 자동으로 분류해줘요', bg: 'linear-gradient(135deg, #6B1E2E 0%, #9B2C45 100%)' },
  { emoji: '\u{1F4CA}', title: '이번 달 지출 현황을 한눈에', desc: '카테고리별 예산 달성률을 대시보드에서 바로 확인해요', bg: 'linear-gradient(135deg, #4A7541 0%, #6AAD5E 100%)' },
  { emoji: '\u{1F3E6}', title: '계좌·카드·고정비 연결하면', desc: '루틴 기록 한 번으로 잔액이 자동으로 반영돼요', bg: 'linear-gradient(135deg, #5C4B8A 0%, #7B6AAD 100%)' },
]

const RANDOM_NAMES = ['데굴데굴 도토리','반짝반짝 별님','폴짝폴짝 토끼','살금살금 고양이','두근두근 하트','알뜨살뜨 다람쥐','포근포근 구름','도란도란 물방울','사블사블 나비','속속 솔방울','통통 밤톨','꺜짝꺜짝 별동별']

const THEME_LIST: { key: Theme; premium?: boolean }[] = [
  { key: 'Burgundy' },
  { key: 'Sage' },
]

const DEFAULT_CATS = ['생활비','고정비','활동비','수입']
const TOTAL_STEPS = 9

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

interface Account { id: string; name: string; bank: string; balance: number }
interface Card { id: string; name: string; bank: string }
interface FixedCostItem { id: string; name: string; amount: number; kind: FixedKind; due_day: number | null }
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
  const [budgetMode, setBudgetMode] = useState<'ai' | 'manual'>('ai')
  const [budgets, setBudgets] = useState<Record<string, number>>({})
  const [budgetLoading, setBudgetLoading] = useState(false)
  const [budgetReason, setBudgetReason] = useState('')
  const [budgetUsedFallback, setBudgetUsedFallback] = useState(false)
  const [budgetLoaded, setBudgetLoaded] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accName, setAccName] = useState('')
  const [accBank, setAccBank] = useState('')
  const [accBalance, setAccBalance] = useState('')
  const [accAdding, setAccAdding] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [cardName, setCardName] = useState('')
  const [cardBank, setCardBank] = useState('')
  const [cardAdding, setCardAdding] = useState(false)
  const [fixedCosts, setFixedCosts] = useState<FixedCostItem[]>([])
  const [fcName, setFcName] = useState('')
  const [fcAmount, setFcAmount] = useState('')
  const [fcKind, setFcKind] = useState<FixedKind>('고정지출')
  const [fcDueDay, setFcDueDay] = useState('')
  const [fcAdding, setFcAdding] = useState(false)
  const [cats, setCats] = useState<string[]>(DEFAULT_CATS)
  const [newCat, setNewCat] = useState('')
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

  async function loadAIBudgets() {
    setBudgetLoading(true); setBudgetReason('')
    try {
      const res = await fetch('/api/budget-recommend', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ income: parseMan(income), fixedSavings: 0, recentExpenses: [], currentBudgets: [], categories: DEFAULT_CATS.filter(c => c !== '수입') }),
      })
      if (res.ok) {
        const data = await res.json()
        setBudgets(data.amounts ?? {}); setBudgetReason(data.reason ?? ''); setBudgetUsedFallback(data.usedFallback ?? false)
      } else { fallbackBudgets() }
    } catch { fallbackBudgets() }
    setBudgetLoading(false); setBudgetLoaded(true)
  }

  function fallbackBudgets() {
    const spend = Math.round(parseMan(income) * 0.75)
    const spendCats = DEFAULT_CATS.filter(c => c !== '수입')
    const dist: Record<string, number> = { '생활비': 0.40, '고정비': 0.35, '활동비': 0.25 }
    const result: Record<string, number> = {}
    spendCats.forEach(c => { result[c] = Math.round(spend * (dist[c] ?? 0.1) / 1000) * 1000 })
    setBudgets(result); setBudgetUsedFallback(true); setBudgetLoaded(true)
  }

  async function addAccount() {
    if (!accName.trim()) return
    setAccAdding(true)
    const { data } = await supabase.from('accounts').insert({ user_id: userId, name: accName.trim(), bank: accBank.trim(), balance: parseInt(accBalance.replace(/,/g, '')) || 0, type: '입출금' }).select().single()
    if (data) setAccounts(prev => [...prev, data])
    setAccName(''); setAccBank(''); setAccBalance(''); setAccAdding(false)
  }

  async function removeAccount(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setAccounts(prev => prev.filter(a => a.id !== id))
  }

  async function addCard() {
    if (!cardName.trim()) return
    setCardAdding(true)
    const { data } = await supabase.from('cards').insert({ user_id: userId, name: cardName.trim(), bank: cardBank.trim() }).select().single()
    if (data) setCards(prev => [...prev, data])
    setCardName(''); setCardBank(''); setCardAdding(false)
  }

  async function removeCard(id: string) {
    await supabase.from('cards').delete().eq('id', id)
    setCards(prev => prev.filter(c => c.id !== id))
  }

  async function addFixedCost() {
    if (!fcName.trim() || !fcAmount) return
    setFcAdding(true)
    const { data } = await supabase.from('fixed_costs').insert({
      user_id: userId,
      name: fcName.trim(),
      amount: parseInt(fcAmount.replace(/,/g, '')) || 0,
      type: '월정액',
      kind: fcKind,
      due_day: fcDueDay ? parseInt(fcDueDay) : null,
    }).select().single()
    if (data) setFixedCosts(prev => [...prev, data])
    setFcName(''); setFcAmount(''); setFcDueDay(''); setFcAdding(false)
  }

  async function removeFixedCost(id: string) {
    await supabase.from('fixed_costs').delete().eq('id', id)
    setFixedCosts(prev => prev.filter(f => f.id !== id))
  }

  async function handleFinish() {
    setSaving(true); setError('')
    try {
      const finalName = name.trim() || suggestedName
      const month = dayjs().format('YYYY-MM')
      const { error: uErr } = await supabase.from('users').upsert({ id: userId, email, name: finalName, income: parseMan(income), saving_goal: parseMan(goal), theme, onboarding_completed: true })
      if (uErr) throw uErr
      if (typeof window !== 'undefined') localStorage.setItem('spenlog_theme', theme)
      if (Object.keys(budgets).length > 0) {
        const rows = Object.entries(budgets).filter(([, amt]) => amt > 0).map(([category, amount]) => ({ user_id: userId, category, amount, month, source: 'ai' }))
        if (rows.length > 0) await supabase.from('budgets').upsert(rows, { onConflict: 'user_id,category,month' })
      }
      const { data: existingCats } = await supabase.from('categories').select('id').eq('user_id', userId).limit(1)
      if (!existingCats?.length && cats.length > 0) {
        await supabase.from('categories').insert(cats.map((n, i) => ({ user_id: userId, name: n, is_default: true, is_hidden: false, sort_order: i })))
      }
      setStep('welcome')
      setTimeout(() => router.push('/'), 2000)
    } catch (e: any) { setError('저장 오류: ' + e.message); setSaving(false) }
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
            ? <button onClick={() => setIntroSlide(s => s + 1)} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: 'var(--color-primary)', color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
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
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>안녕하세요! 😊</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>어떻게 불러드릴까요?</p>
        <div style={{ background: primaryLight, borderRadius: '16px', padding: '20px', marginBottom: '16px', textAlign: 'center' as const }}>
          <p style={{ fontSize: '22px', fontWeight: '700', color: primary, marginBottom: '12px' }}>{suggestedName}</p>
          <button onClick={() => setSuggestedName(randomName())} style={{ padding: '8px 18px', borderRadius: '20px', border: '1.5px solid ' + primary, background: 'white', color: primary, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>🔀 다른 이름</button>
        </div>
        <p style={{ fontSize: '13px', color: '#B8A8AC', marginBottom: '8px' }}>또는 직접 입력</p>
        <input type="text" placeholder="닉네임 입력 (선택)" value={name} onChange={e => setName(e.target.value)} maxLength={12} style={inputStyle} />
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '6px' }}>입력하지 않으면 {'"'}{suggestedName}{'"'}으로 시작해요</p>
        <div style={{ marginTop: '32px' }}>
          <button onClick={() => setStep('theme')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
        </div>
      </div>
    )
  }

  if (step === 'theme') {
    return (
      <>
        <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
          <ProgressBar current={1} total={TOTAL_STEPS} color={primary} />
          <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>나만의 감성을 골라봐요 🎨</h1>
          <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>언제든지 설정에서 바꾸당 수 있어요</p>
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
          <p style={{ fontSize: 12, color: '#B8A8AC', textAlign: 'center' as const, marginBottom: 24 }}>✨ 더 많은 테마는 설정에서 만나보세요!</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
            <button onClick={async () => {
              await supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
              if (typeof window !== 'undefined') localStorage.setItem('spenlog_onboarding_completed', 'true')
              setStep('income')
            }} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
            <button onClick={() => setStep('name')} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
          </div>
        </div>
        {showPremiumSheet && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'flex-end' }}>
            <div style={{ width: '100%', background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 40px' }}>
              <p style={{ fontSize: 22, textAlign: 'center', marginBottom: 8 }}>💎</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', textAlign: 'center', marginBottom: 8 }}>프리미엄 전용 테마예요</p>
              <p style={{ fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 1.6, marginBottom: 24 }}>설정 탭에서 프리미엄으로 업그레이드하면 모든 테마를 자유롭게 사용할 수 있어요</p>
              <button onClick={async () => {
                setTheme('Burgundy'); setShowPremiumSheet(false)
                await supabase.from('users').update({ onboarding_completed: true }).eq('id', userId)
                if (typeof window !== 'undefined') localStorage.setItem('spenlog_onboarding_completed', 'true')
                setStep('income')
              }} style={{ width: '100%', padding: '14px', borderRadius: 14, background: '#f3f4f6', color: '#6b7280', fontSize: 14, fontWeight: 500, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>기본 테마로 계속</button>
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
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>월 수입을 알려줘요 💰</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>세후 실수령 기준이에요. 나중에 바꾸당 수 있어요.</p>
        <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>월 수입 (세후)</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="text" inputMode="numeric" placeholder="300" value={income} onChange={e => setIncome(formatWon(e.target.value))} style={{ ...inputStyle, flex: 1 }} autoFocus />
          <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
        </div>
        {income && <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>= {parseMan(income).toLocaleString()}원</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '32px' }}>
          <button onClick={() => setStep('goal')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={() => { setIncome(''); setStep('goal') }} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('theme')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'goal') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={3} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '26px', fontWeight: '800', color: primary, marginBottom: '8px' }}>저축 목표가 있나요? 🎯</h1>
        <p style={{ fontSize: '15px', color: '#B8A8AC', marginBottom: '32px' }}>매달 이만큼 저축하는 게 목표예요</p>
        <label style={{ fontSize: '13px', color: '#9A7A80', marginBottom: '8px', display: 'block', fontWeight: '600' }}>월 저축 목표 <span style={{ fontWeight: '400', color: '#C4A0A8' }}>(선택)</span></label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="text" inputMode="numeric" placeholder="50" value={goal} onChange={e => setGoal(formatWon(e.target.value))} style={{ ...inputStyle, flex: 1 }} autoFocus />
          <span style={{ fontSize: '15px', color: primary, fontWeight: '600', whiteSpace: 'nowrap' as const }}>만 원</span>
        </div>
        {goal && <p style={{ fontSize: '12px', color: '#9A7A80', marginTop: '6px' }}>= {parseMan(goal).toLocaleString()}원</p>}
        <p style={{ fontSize: '11px', color: '#C4A0A8', marginTop: '8px' }}>💡 입력하면 홈 화면에서 저축 달성률을 볼 수 있어요</p>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '32px' }}>
          <button onClick={async () => {
            await supabase.from('users').update({ init_setup_completed: true }).eq('id', userId)
            if (typeof window !== 'undefined') localStorage.setItem('spenlog_init_setup_completed', 'true')
            setBudgetLoaded(false); setStep('budget')
          }} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={async () => {
            await supabase.from('users').update({ init_setup_completed: true }).eq('id', userId)
            if (typeof window !== 'undefined') localStorage.setItem('spenlog_init_setup_completed', 'true')
            setGoal(''); setBudgetLoaded(false); setStep('budget')
          }} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('income')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'budget') {
    const spendCats = DEFAULT_CATS.filter(c => c !== '수입')
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={4} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: primary, marginBottom: '6px' }}>예산을 설정해봐요 📋</h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '20px' }}>나중에 예산 탭에서 바꾸당 수 있어요</p>
        <div style={{ display: 'flex', background: primaryLight, borderRadius: 12, padding: 3, marginBottom: 20, gap: 3 }}>
          {(['ai', 'manual'] as const).map(m => (
            <button key={m} onClick={() => setBudgetMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 10, border: 'none', background: budgetMode === m ? primary : 'transparent', color: budgetMode === m ? '#fff' : primary, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              {m === 'ai' ? '✨ AI 추천' : '직접 입력'}
            </button>
          ))}
        </div>
        {budgetMode === 'ai' && !budgetLoaded && (
          <div style={{ textAlign: 'center' as const, padding: '24px 0' }}>
            <p style={{ fontSize: 14, color: '#9A7A80', marginBottom: 16 }}>{income ? `월 수입 ${income}만원 기준으로 예산을 추천받아요` : '기본 비율로 예산을 추천해드릴게요'}</p>
            <button onClick={loadAIBudgets} disabled={budgetLoading} style={{ padding: '14px 28px', borderRadius: 14, background: primary, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{budgetLoading ? '분석 중...' : '✨ AI 추천 받기'}</button>
          </div>
        )}
        {(budgetMode === 'manual' || (budgetMode === 'ai' && budgetLoaded)) && (
          <>
            {budgetMode === 'ai' && (
              <div style={{ background: primaryLight, borderRadius: 12, padding: '10px 14px', marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: primary, lineHeight: 1.5 }}>💡 {budgetUsedFallback ? '지출 기록이 없어 기본 비율으로 추천했어요' : budgetReason}</p>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10, marginBottom: 8 }}>
              {spendCats.map(cat => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', width: 56, flexShrink: 0 }}>{cat}</span>
                  <input type="text" inputMode="numeric" placeholder="0" value={budgets[cat] ? budgets[cat].toLocaleString() : ''} onChange={e => { const val = parseInt(e.target.value.replace(/,/g, '')) || 0; setBudgets(prev => ({ ...prev, [cat]: val })) }} style={{ ...inputStyle, padding: '10px 12px', fontSize: 14, flex: 1 }} />
                  <span style={{ fontSize: 12, color: '#9A7A80', flexShrink: 0 }}>원</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '20px' }}>
          <button onClick={() => setStep('assets')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={() => { setBudgets({}); setStep('assets') }} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('goal')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'assets') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={5} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: primary, marginBottom: '6px' }}>통장을 등록해봐요 🏦</h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '20px' }}>잔액을 관리하고 싶은 계좌예요 <span style={{ fontSize: 12 }}>(선택)</span></p>
        {accounts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
            {accounts.map(acc => (
              <div key={acc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: primaryLight, borderRadius: 12, padding: '10px 14px' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: primary }}>{acc.name}</p>
                  <p style={{ fontSize: 12, color: '#9A7A80' }}>{acc.bank} · {acc.balance.toLocaleString()}원</p>
                </div>
                <button onClick={() => removeAccount(acc.id)} style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid ' + primaryLight, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: primary, marginBottom: 12 }}>계좌 추가</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <input type="text" placeholder="계좌 이름 (예: 주거래통장)" value={accName} onChange={e => setAccName(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }} />
            <input type="text" placeholder="은행명 (예: 카카오뱅크)" value={accBank} onChange={e => setAccBank(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" inputMode="numeric" placeholder="현재 잔액" value={accBalance} onChange={e => setAccBalance(formatWon(e.target.value))} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14, flex: 1 }} />
              <span style={{ fontSize: 13, color: '#9A7A80', alignSelf: 'center', flexShrink: 0 }}>원</span>
            </div>
          </div>
          <button onClick={addAccount} disabled={accAdding || !accName.trim()} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 12, background: accName.trim() ? primary : '#f3f4f6', color: accName.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{accAdding ? '추가 중...' : '+ 계좌 추가'}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          <button onClick={() => setStep('cards')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={async () => {
            await supabase.from('users').update({ asset_setup_skipped: true }).eq('id', userId)
            if (typeof window !== 'undefined') localStorage.setItem('spenlog_asset_setup_skipped', 'true')
            setStep('cards')
          }} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('budget')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'cards') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={6} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: primary, marginBottom: '6px' }}>카드를 등록해봐요 💳</h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '20px' }}>지출 입력 시 결제수단으로 사용해요 <span style={{ fontSize: 12 }}>(선택)</span></p>
        {cards.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
            {cards.map(card => (
              <div key={card.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: primaryLight, borderRadius: 12, padding: '10px 14px' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: primary }}>{card.name}</p>
                  {card.bank && <p style={{ fontSize: 12, color: '#9A7A80' }}>{card.bank}</p>}
                </div>
                <button onClick={() => removeCard(card.id)} style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>✕</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid ' + primaryLight, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: primary, marginBottom: 12 }}>카드 추가</p>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <input type="text" placeholder="카드 이름 (예: 신한카드)" value={cardName} onChange={e => setCardName(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }} />
            <input type="text" placeholder="카드사 (예: 신한)" value={cardBank} onChange={e => setCardBank(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }} />
          </div>
          <button onClick={addCard} disabled={cardAdding || !cardName.trim()} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 12, background: cardName.trim() ? primary : '#f3f4f6', color: cardName.trim() ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{cardAdding ? '추가 중...' : '+ 카드 추가'}</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          <button onClick={() => setStep('fixedcosts')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={() => setStep('fixedcosts')} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('assets')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'fixedcosts') {
    const spendItems = fixedCosts.filter(f => f.kind === '고정지출')
    const saveItems = fixedCosts.filter(f => f.kind === '고정저축')
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={7} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: primary, marginBottom: '6px' }}>고정비를 등록해봐요 📌</h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '8px' }}>매달 나가는 돈을 한 번에 정리해요 <span style={{ fontSize: 12 }}>(선택)</span></p>
        <p style={{ fontSize: 12, color: '#C4A0A8', marginBottom: 20 }}>💡 월세·통신비·구독료·적산자동 등 매달 반복되는 지출을 등록하는 곣이에요</p>

        {fixedCosts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8, marginBottom: 16 }}>
            {spendItems.length > 0 && (
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9A7A80', marginBottom: 2 }}>고정지출</p>
            )}
            {spendItems.map(fc => (
              <div key={fc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: primaryLight, borderRadius: 12, padding: '10px 14px' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: primary }}>{fc.name}</p>
                  <p style={{ fontSize: 12, color: '#9A7A80' }}>{fc.amount.toLocaleString()}원{fc.due_day ? ` · 매월 ${fc.due_day}일` : ''}</p>
                </div>
                <button onClick={() => removeFixedCost(fc.id)} style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>✕</button>
              </div>
            ))}
            {saveItems.length > 0 && (
              <p style={{ fontSize: 11, fontWeight: 700, color: '#9A7A80', marginTop: 4, marginBottom: 2 }}>고정저축</p>
            )}
            {saveItems.map(fc => (
              <div key={fc.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f0fdf4', borderRadius: 12, padding: '10px 14px', border: '1px solid #bbf7d0' }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: '#16a34a' }}>{fc.name}</p>
                  <p style={{ fontSize: 12, color: '#9A7A80' }}>{fc.amount.toLocaleString()}원{fc.due_day ? ` · 매월 ${fc.due_day}일` : ''}</p>
                </div>
                <button onClick={() => removeFixedCost(fc.id)} style={{ fontSize: 16, background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 16, border: '1.5px solid ' + primaryLight, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: primary, marginBottom: 12 }}>고정비 추가</p>
          <div style={{ display: 'flex', background: primaryLight, borderRadius: 10, padding: 3, marginBottom: 10, gap: 3 }}>
            {(['고정지출', '고정저축'] as FixedKind[]).map(k => (
              <button key={k} onClick={() => setFcKind(k)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: fcKind === k ? primary : 'transparent', color: fcKind === k ? '#fff' : primary, fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' }}>{k}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
            <input type="text" placeholder="이름 (예: 월세, 넥플릭스)" value={fcName} onChange={e => setFcName(e.target.value)} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14 }} />
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" inputMode="numeric" placeholder="금액" value={fcAmount} onChange={e => setFcAmount(formatWon(e.target.value))} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14, flex: 2 }} />
              <span style={{ fontSize: 13, color: '#9A7A80', alignSelf: 'center', flexShrink: 0 }}>원</span>
              <input type="text" inputMode="numeric" placeholder="낙부일" value={fcDueDay} onChange={e => setFcDueDay(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14, flex: 1 }} />
              <span style={{ fontSize: 13, color: '#9A7A80', alignSelf: 'center', flexShrink: 0 }}>일</span>
            </div>
          </div>
          <button onClick={addFixedCost} disabled={fcAdding || !fcName.trim() || !fcAmount} style={{ width: '100%', marginTop: 12, padding: '10px', borderRadius: 12, background: (fcName.trim() && fcAmount) ? primary : '#f3f4f6', color: (fcName.trim() && fcAmount) ? '#fff' : '#9ca3af', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>{fcAdding ? '추가 중...' : '+ 고정비 추가'}</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px' }}>
          <button onClick={() => setStep('categories')} style={{ width: '100%', padding: '16px', borderRadius: '16px', background: primary, color: '#fff', fontSize: '15px', fontWeight: '600', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>다음 →</button>
          <button onClick={() => setStep('categories')} style={{ background: 'none', border: 'none', color: '#B8A8AC', fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>건너뛰기</button>
          <button onClick={() => setStep('cards')} style={{ background: 'none', border: 'none', color: '#C4A0A8', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit' }}>← 이전</button>
        </div>
      </div>
    )
  }

  if (step === 'categories') {
    return (
      <div style={{ maxWidth: 420, margin: '0 auto', padding: '0 24px' }}>
        <ProgressBar current={8} total={TOTAL_STEPS} color={primary} />
        <h1 style={{ fontSize: '24px', fontWeight: '800', color: primary, marginBottom: '6px' }}>카테고리를 확인해요 🏷️</h1>
        <p style={{ fontSize: '14px', color: '#B8A8AC', marginBottom: '6px' }}>필요하면 추가·삭제할 수 있어요</p>
        <p style={{ fontSize: 12, color: '#C4A0A8', marginBottom: 16 }}>💡 다른 카테고리는 설정 탭에서도 관리할 수 있어요</p>
        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 8, marginBottom: 16 }}>
          {cats.map(cat => (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 6, background: primaryLight, borderRadius: 20, padding: '7px 12px' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: primary }}>{cat}</span>
              <button onClick={() => setCats(prev => prev.filter(c => c !== cat))} style={{ fontSize: 13, color: primary, background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1, padding: 0, opacity: 0.6 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <input type="text" placeholder="새 카테고리 이름" value={newCat} onChange={e => setNewCat(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newCat.trim()) { setCats(prev => [...prev, newCat.trim()]); setNewCat('') } }} style={{ ...inputStyle, padding: '10px 14px', fontSize: 14, flex: 1 }} />
          <button onClick={() => { if (newCat.trim()) { setCats(prev => [...prev, newCat.trim()]); setNewCat('') } }} style={{ padding: '10px 16px', borderRadius: 12, background: primary, color: '#fff', fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>추가</button>
        </div>
        <p style={{ fontSize: 11, color: '#C4A0A8', marginBottom: 20 }}>💡 수입 카테고리는 수입 기록 시 사용돼요</p>
        {error && <p style={{ fontSize: '13px', color: '#E05070', marginBottom: '8px' }}>{error}</p>}
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: '10px', marginTop: '8px' }}>
          <button onClick={handleFinish} disabled={saving} style={{ width: '100%', padding: '16px', borderRadius: '16px'
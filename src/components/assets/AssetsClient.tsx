'use client'
import React, { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import CategoryManager from './CategoryManager'
import RoutineBanner from './RoutineBanner'
import { Account, Card, FixedCost } from '@/types'
import { formatCurrency } from '@/lib/format'
import AssetsGuide from './AssetsGuide'

interface Budget { id: string; category: string; amount: number; month: string }
interface Expense { id: string; name: string; amount: number; category: string; date: string; payment_method: string | null }
interface Props {
  profile: any; userId: string
  accounts: Account[]; cards: Card[]; fixedCosts: FixedCost[]
  budgets: Budget[]; thisMonthSpent: number
  categorySpent: Record<string, number>; thisMonth: string
  customCategories?: any[]
  expenses?: Expense[]
}

function fmt(v: string) { const n = v.replace(/[^0-9]/g, ''); return n ? Number(n).toLocaleString() : '' }
function parse(v: string) { return parseInt(v.replace(/,/g, '')) || 0 }

function Section({ icon, title, summary, children, defaultOpen = false }: {
  icon: string; title: string; summary: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ background: '#fff', borderRadius: 18, border: '1px solid #f0f0f0', marginBottom: 10, overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon && <span style={{ fontSize: 18 }}>{icon}</span>}
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{summary}</span>
          <span style={{ fontSize: 14, color: '#9ca3af', display: 'inline-block', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

function InlineForm({ fields, onSave, onCancel }: {
  fields: { label: string; key: string; type?: string; options?: string[]; placeholder?: string }[]
  onSave: (vals: Record<string, string>) => void
  onCancel: () => void
}) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map(f => [f.key, ''])))
  const inp: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb',
    background: '#fafafa', fontSize: 13, color: '#374151', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit',
  }
  return (
    <div style={{ background: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10 }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{f.label}</label>
          {f.options ? (
            <select value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} style={inp}>
              <option value="">선택</option>
              {f.options.map(o => {
                const parts = o.split('|')
                const label = parts.length >= 3 ? parts[2] : o
                return <option key={o} value={o}>{label}</option>
              })}
            </select>
          ) : (
            <input type="text"
              inputMode={f.type === 'number' ? 'numeric' : undefined}
              placeholder={f.placeholder ?? ''}
              value={vals[f.key]}
              onChange={e => setVals(v => ({ ...v, [f.key]: f.type === 'number' ? fmt(e.target.value) : e.target.value }))}
              style={inp} />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(vals)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>저장</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
}

function FixedRow({ item, accountName, targetAccountName, onDelete, onEdit }: {
  item: FixedCost; accountName?: string; targetAccountName?: string
  onDelete: () => Promise<void>; onEdit: (updates: Record<string, unknown>) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [vals, setVals] = useState({ name: item.name, amount: String(item.amount), due_day: String((item as any).due_day ?? '') })

  if (editing) {
    return (
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input value={vals.name} onChange={e => setVals(p => ({ ...p, name: e.target.value }))}
            style={{ padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} placeholder="이름" />
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={vals.amount} onChange={e => setVals(p => ({ ...p, amount: e.target.value }))} type="number"
              style={{ flex: 1, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} placeholder="금액" />
            <input value={vals.due_day} onChange={e => setVals(p => ({ ...p, due_day: e.target.value }))} type="number"
              style={{ width: 60, padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit' }} placeholder="출금일" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => { onEdit({ name: vals.name, amount: parseInt(vals.amount) || item.amount, due_day: parseInt(vals.due_day) || null }); setEditing(false) }}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
            <button onClick={() => setEditing(false)}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        </div>
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 500, color: '#1f2937' }}>{item.name}</p>
        <p style={{ fontSize: 11, color: '#9ca3af' }}>
          {(item as any).due_day ? '매월 ' + (item as any).due_day + '일' : ''}{accountName ? ' · ' + accountName : ''}
          {targetAccountName && <span style={{ color: '#3b82f6' }}> → {targetAccountName}</span>}
        </p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>{formatCurrency(item.amount)}</span>
        <button onClick={() => setEditing(true)} style={{ fontSize: 11, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
        <button onClick={onDelete} style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
      </div>
    </div>
  )
}

function BudgetRow({ category, budgetAmt, spent, onSave }: {
  category: string; budgetAmt: number; spent: number; onSave: (amt: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState(budgetAmt > 0 ? budgetAmt.toLocaleString() : '')
  const pct = budgetAmt > 0 ? Math.min(Math.round((spent / budgetAmt) * 100), 100) : 0
  const over = budgetAmt > 0 && spent > budgetAmt
  const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{category}</span>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="text" inputMode="numeric" value={val}
              onChange={e => setVal(fmt(e.target.value))}
              style={{ width: 100, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 12, outline: 'none', fontFamily: 'inherit' }}
              autoFocus />
            <button onClick={() => { onSave(parse(val)); setEditing(false) }}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
            <button onClick={() => setEditing(false)}
              style={{ fontSize: 11, padding: '4px 8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {budgetAmt > 0 ? (
              <span style={{ fontSize: 13, fontWeight: 700, color: over ? '#ef4444' : '#374151' }}>
                {formatCurrency(spent)} / {formatCurrency(budgetAmt)}{over ? ' ⚠️' : ''}
              </span>
            ) : <span style={{ fontSize: 11, color: '#9ca3af' }}>미설정</span>}
            <button onClick={() => setEditing(true)} style={{ fontSize: 10, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✏️</button>
          </div>
        )}
      </div>
      {budgetAmt > 0 && (
        <div style={{ background: '#f3f4f6', borderRadius: 99, height: 6, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 99, width: pct + '%', background: barColor, transition: 'width 0.4s' }} />
        </div>
      )}
    </div>
  )
}

export default function AssetsClient({ profile, userId, accounts, cards, fixedCosts, budgets, thisMonthSpent, categorySpent, thisMonth, customCategories, expenses = [] }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [localAccounts, setLocalAccounts] = useState(accounts)
  const [localCards, setLocalCards] = useState(cards)
  const [localFixed, setLocalFixed] = useState(fixedCosts)
  const [localBudgets, setLocalBudgets] = useState(budgets)
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showCashForm, setShowCashForm] = useState(false)
  const [cashBalance, setCashBalance] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [showAddFixed, setShowAddFixed] = useState<'expense' | 'saving' | null>(null)
  const [editingIncome, setEditingIncome] = useState(false)
  // 카드 납부 기록 바텀시트
  const [cardPaySheet, setCardPaySheet] = useState<Card | null>(null)
  const [cardPayAmount, setCardPayAmount] = useState('')
  const [cardPayDate, setCardPayDate] = useState('')
  const [cardPayMemo, setCardPayMemo] = useState('')
  const [cardPayAmountErr, setCardPayAmountErr] = useState(false)
  const [cardPaySaving, setCardPaySaving] = useState(false)
  const [cardPaidIds, setCardPaidIds] = useState<Set<string>>(new Set())
  const [cardPayToast, setCardPayToast] = useState('')

  // 이번 달 카드 납부 완료 목록 초기 로딩 (expenses 테이블 기준)
  useEffect(() => {
    async function loadPaidCards() {
      const startOfMonth = thisMonth + '-01'
      const { data } = await supabase
        .from('expenses')
        .select('payment_method, name')
        .eq('user_id', userId)
        .gte('date', startOfMonth)
        .ilike('name', '%카드 대금%')
      if (data) {
        const paidCardNames = new Set(data.map(e => e.payment_method).filter(Boolean))
        const paidIds = new Set(
          localCards.filter(c => paidCardNames.has(c.name)).map(c => c.id)
        )
        setCardPaidIds(paidIds)
      }
    }
    if (localCards.length > 0) loadPaidCards()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, thisMonth])

  const [income, setIncome] = useState(profile?.income ? Number(profile.income).toLocaleString() : '')
  const [savingGoal, setSavingGoal] = useState(profile?.saving_goal ? Number(profile.saving_goal).toLocaleString() : '')

  const monthlyIncome = profile?.income ?? 0
  const fixedExpenses = localFixed.filter(f => !(f as any).kind || (f as any).kind === '고정지출')
  const fixedSavings = localFixed.filter(f => (f as any).kind === '고정저축')
  const fixedExpenseTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const fixedSavingTotal = fixedSavings.reduce((s, f) => s + f.amount, 0)
  const totalBalance = localAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalBudget = localBudgets.reduce((s, b) => s + b.amount, 0)

  // 계좌+카드 통합 옵션
  const linkedOptions = [
    ...localAccounts.map(a => a.id + '|account|' + a.name + ' · ' + a.bank),
    ...localCards.map(c => c.id + '|card|' + c.name + ' · ' + c.bank),
  ]

  // 카드 납부 상태 계산
  function getCardPayStatus(card: Card): { label: string; color: string; isToday: boolean } {
    if (!card.due_day) return { label: '', color: '#9ca3af', isToday: false }
    const today = new Date()
    const thisYear = today.getFullYear()
    const thisMonthNum = today.getMonth() + 1
    const todayDay = today.getDate()
    const due = card.due_day

    if (cardPaidIds.has(card.id)) return { label: '✓ 완료', color: '#10b981', isToday: false }

    const diff = due - todayDay
    if (diff === 0) return { label: '오늘 납부일 ⚠️', color: '#f59e0b', isToday: true }
    if (diff < 0) return { label: '지연 ⚠️', color: '#ef4444', isToday: false }
    return { label: `D-${diff}`, color: '#9ca3af', isToday: false }
  }

  function openCardPaySheet(card: Card) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    setCardPaySheet(card)
    setCardPayAmount('')
    setCardPayDate(`${yyyy}-${mm}-${dd}`)
    setCardPayMemo('')
    setCardPayAmountErr(false)
  }

  async function saveCardPayment() {
    if (!cardPaySheet) return
    if (!cardPayAmount) { setCardPayAmountErr(true); return }
    setCardPaySaving(true)
    const amount = parseInt(cardPayAmount.replace(/,/g, '')) || 0
    const today = new Date()
    const monthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

    await supabase.from('expenses').insert({
      user_id: userId,
      type: 'expense',
      category: '고정비',
      name: `${cardPaySheet.name} 카드 대금`,
      amount,
      date: cardPayDate,
      payment_method: cardPaySheet.name,
      memo: cardPayMemo || null,
      source: 'manual',
    })

    setCardPaidIds(s => new Set([...s, cardPaySheet!.id]))
    setCardPaySaving(false)
    setCardPaySheet(null)
    setCardPayToast('기록됐어요 ✓')
    setTimeout(() => setCardPayToast(''), 2500)
    router.refresh()
  }

  async function saveIncome() {
    await supabase.from('users').update({ income: parse(income), saving_goal: parse(savingGoal) }).eq('id', userId)
    setEditingIncome(false)
    router.refresh()
  }

  async function addAccount(vals: Record<string, string>) {
    const { data } = await supabase.from('accounts').insert({
      user_id: userId, name: vals.name, bank: vals.bank,
      balance: parse(vals.balance), type: vals.type || '입출금',
    }).select().single()
    if (data) setLocalAccounts(a => [...a, data])
    setShowAddAccount(false)
  }

  async function deleteAccount(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setLocalAccounts(a => a.filter(x => x.id !== id))
  }

  async function addCard(vals: Record<string, string>) {
    const rawLinked = vals.linked_account_id || ''
    const linkedId = rawLinked.includes('|') ? rawLinked.split('|')[0] : rawLinked || null
    const { data } = await supabase.from('cards').insert({
      user_id: userId, name: vals.name, bank: vals.bank,
      due_day: parseInt(vals.due_day) || null,
      linked_account_id: linkedId,
    }).select().single()
    if (data) setLocalCards(c => [...c, data])
    setShowAddCard(false)
  }

  async function deleteCard(id: string) {
    await supabase.from('cards').delete().eq('id', id)
    setLocalCards(c => c.filter(x => x.id !== id))
  }

  async function addFixed(vals: Record<string, string>, kind: '고정지출' | '고정저축') {
    const rawLinked = vals.linked_account_id || ''
    const linkedId = rawLinked.includes('|') ? rawLinked.split('|')[0] : rawLinked || null
    const { data } = await supabase.from('fixed_costs').insert({
      user_id: userId, name: vals.name, amount: parse(vals.amount),
      kind, due_day: parseInt(vals.due_day) || null,
      linked_account_id: linkedId, type: '월정액',
      linked_target_account_id: (() => {
        const raw = vals.linked_target_account_id || ''
        return raw.includes('|') ? raw.split('|')[0] : raw || null
      })(),
    }).select().single()
    if (data) setLocalFixed(f => [...f, data])
    setShowAddFixed(null)
  }

  async function editFixed(id: string, updates: any) {
    await supabase.from('fixed_costs').update(updates).eq('id', id)
    setLocalFixed(f => f.map(fc => fc.id === id ? { ...fc, ...updates } : fc))
  }

  async function deleteFixed(id: string) {
    await supabase.from('fixed_costs').delete().eq('id', id)
    setLocalFixed(f => f.filter(x => x.id !== id))
  }

  async function saveBudget(category: string, amount: number) {
    const existing = localBudgets.find(b => b.category === category)
    if (existing) {
      await supabase.from('budgets').update({ amount }).eq('id', existing.id)
      setLocalBudgets(bs => bs.map(b => b.category === category ? { ...b, amount } : b))
    } else {
      const { data } = await supabase.from('budgets').insert({ user_id: userId, category, amount, month: thisMonth }).select().single()
      if (data) setLocalBudgets(bs => [...bs, data])
    }
  }

  const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #f9fafb' }
  const addBtnStyle = (color: string, bg: string): React.CSSProperties => ({
    fontSize: 11, color, background: bg, border: 'none', padding: '4px 10px',
    borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
  })
  const fullAddBtn: React.CSSProperties = {
    marginTop: 8, fontSize: 12, color: 'var(--color-primary)', fontWeight: 600,
    background: 'var(--color-primary-light)', border: 'none', padding: '8px 14px',
    borderRadius: 10, cursor: 'pointer', fontFamily: 'inherit', width: '100%',
  }

  return (
    <>
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <AssetsGuide />
      <AssetsGuide hasNoAccounts={localAccounts.length === 0} />
      <h1 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-accent)' }}>자산</h1>

      {/* 루틴 배너 */}
      <RoutineBanner
        userId={userId}
        fixedCosts={[...localFixed].map(f => ({ ...f, kind: (f as any).kind ?? '고정지출', due_day: (f.due_day ?? undefined) as number | undefined }))}
        thisMonth={thisMonth}
        onAccountsChange={(updates) => {
          setLocalAccounts(prev =>
            prev.map(acc => {
              const u = updates.find(u => u.id === acc.id)
              return u ? { ...acc, balance: u.balance } : acc
            })
          )
        }}
      />

      {/* 1. 월 수입 */}
      <Section icon="" title="월 수입" summary={monthlyIncome > 0 ? formatCurrency(monthlyIncome) : '미설정'} defaultOpen={!monthlyIncome}>
        {!editingIncome ? (
          <div>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)', marginBottom: 8 }}>{formatCurrency(monthlyIncome)}</p>
            {profile?.saving_goal > 0 && <p style={{ fontSize: 12, color: '#6b7280' }}>저축 목표 {formatCurrency(Number(profile.saving_goal))}</p>}
            <button onClick={() => setEditingIncome(true)} style={{ marginTop: 10, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✏️ 수정</button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>월 수입 (세후)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>₩</span>
                <input type="text" inputMode="numeric" value={income}
                  onChange={e => setIncome(fmt(e.target.value))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fafafa', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>저축 목표 (선택)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-primary)' }}>₩</span>
                <input type="text" inputMode="numeric" value={savingGoal}
                  onChange={e => setSavingGoal(fmt(e.target.value))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fafafa', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveIncome} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
              <button onClick={() => setEditingIncome(false)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
            </div>
          </div>
        )}
      </Section>

      {/* 2. 예산 */}
      <Section icon="" title="예산" summary={totalBudget > 0 ? `총 ${formatCurrency(totalBudget)} 설정` : '미설정'}>
        {((customCategories && customCategories.length > 0 ? customCategories.map((cc:any) => cc.name ?? cc) : (CATEGORIES as readonly string[])).filter((cat: string) => cat !== '수입')).map(cat => (
          <BudgetRow key={cat} category={cat}
            budgetAmt={localBudgets.find(b => b.category === cat)?.amount ?? 0}
            spent={categorySpent[cat] ?? 0}
            onSave={amt => saveBudget(cat, amt)} />
        ))}
        {totalBudget > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>총 예산</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-accent)' }}>{formatCurrency(totalBudget)}</span>
          </div>
        )}

      </Section>

      {/* 3. 계좌/현금 */}
      <Section icon="" title="계좌 / 현금" summary={`총 잔액 ${formatCurrency(totalBalance)}`}>
        {showAddAccount && (
          <InlineForm
            fields={[
              { label: '계좌명', key: 'name', placeholder: '예) 국민 주거래통장' },
              { label: '은행', key: 'bank', placeholder: '예) KB국민' },
              { label: '잔액', key: 'balance', type: 'number', placeholder: '0' },
              { label: '유형', key: 'type', options: ['입출금', '파킹', 'CMA', '현금'] },
            ]}
            onSave={addAccount}
            onCancel={() => setShowAddAccount(false)} />
        )}
        {localAccounts.length === 0 && !showAddAccount && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>등록된 계좌가 없어요</p>}
        {localAccounts.map(acc => (
          <div key={acc.id} style={rowStyle}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{acc.name}</p>
              <p style={{ fontSize: 11, color: '#9ca3af' }}>{acc.bank} · {acc.type}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrency(acc.balance ?? 0)}</span>
              <button onClick={() => deleteAccount(acc.id)} style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
            </div>
          </div>
        ))}
        {showCashForm ? (
          <div style={{ marginTop: 8, padding: '14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>💵 현금 추가</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text" inputMode="numeric" autoFocus
                  placeholder="보유 현금 잔액"
                  value={cashBalance ? Number(cashBalance.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={e => setCashBalance(e.target.value.replace(/[^0-9]/g, ''))}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && cashBalance) {
                      supabase.from('accounts').insert({
                        user_id: userId, name: '현금', bank: '현금',
                        balance: parseInt(cashBalance), type: '현금',
                      }).select().single().then(({ data }) => {
                        if (data) setLocalAccounts(a => [...a, data])
                        setShowCashForm(false); setCashBalance('')
                      })
                    }
                  }}
                  style={{
                    width: '100%', padding: '10px 36px 10px 12px',
                    borderRadius: 10, border: '1.5px solid #6ee7b7',
                    fontSize: 14, outline: 'none', fontFamily: 'inherit',
                    background: '#fff', boxSizing: 'border-box',
                  }}
                />
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>원</span>
              </div>
              <button
                onClick={() => {
                  if (!cashBalance) return
                  supabase.from('accounts').insert({
                    user_id: userId, name: '현금', bank: '현금',
                    balance: parseInt(cashBalance), type: '현금',
                  }).select().single().then(({ data }) => {
                    if (data) setLocalAccounts(a => [...a, data])
                    setShowCashForm(false); setCashBalance('')
                  })
                }}
                style={{
                  padding: '10px 16px', borderRadius: 10, border: 'none',
                  background: '#059669', color: '#fff',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >등록</button>
              <button
                onClick={() => { setShowCashForm(false); setCashBalance('') }}
                style={{
                  padding: '10px 12px', borderRadius: 10,
                  border: '1.5px solid #d1fae5', background: '#fff',
                  fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >취소</button>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => { setShowCashForm(s => !s); setShowAddAccount(false) }}
            style={{ ...fullAddBtn, flex: 1, background: '#f0fdf4', color: '#059669' }}
          >💵 현금 추가</button>
          <button onClick={() => { setShowAddAccount(s => !s); setShowCashForm(false) }} style={{ ...fullAddBtn, flex: 1 }}>+ 계좌 추가</button>
        </div>
      </Section>

      {/* 4. 카드 */}
      <Section icon="" title="카드" summary={localCards.length > 0 ? localCards.length + '개 등록' : '미등록'}>
        {showAddCard && (
          <InlineForm
            fields={[
              { label: '카드명', key: 'name', placeholder: '예) 신한카드' },
              { label: '카드사', key: 'bank', placeholder: '예) 신한' },
              { label: '대금 출금일', key: 'due_day', placeholder: '예) 15' },
              { label: '연결 계좌/카드', key: 'linked_account_id', options: linkedOptions },
            ]}
            onSave={addCard}
            onCancel={() => setShowAddCard(false)} />
        )}
        {localCards.length === 0 && !showAddCard && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>등록된 카드가 없어요</p>}
        {localCards.map(card => {
          const cardExpenses = expenses.filter(e => e.payment_method === card.name)
          const cardTotal = cardExpenses.reduce((s, e) => s + Number(e.amount), 0)
          const isExpanded = expandedCardId === card.id
          const payStatus = getCardPayStatus(card)
          return (
            <div key={card.id} style={{ marginBottom: 2 }}>
              <div style={{ ...rowStyle, borderBottom: isExpanded ? 'none' : '1px solid #f9fafb' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{card.name}</p>
                    {payStatus.label && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: payStatus.color, background: payStatus.color + '18', padding: '2px 7px', borderRadius: 10 }}>
                        {payStatus.label}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 11, color: '#9ca3af' }}>
                    {card.bank}{card.due_day ? ' · 납부일 매월 ' + card.due_day + '일' : ''}
                    {card.linked_account ? ' · ' + (localAccounts.find(a => a.id === card.linked_account)?.name ?? '') : ''}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {card.due_day && !cardPaidIds.has(card.id) && (
                    <button
                      onClick={() => openCardPaySheet(card)}
                      style={{ fontSize: 11, color: payStatus.isToday ? '#f59e0b' : '#6b7280', background: payStatus.isToday ? '#fffbeb' : '#f9fafb', border: `1px solid ${payStatus.isToday ? '#fde68a' : '#e5e7eb'}`, padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    >납부 기록</button>
                  )}
                  <button
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    style={{ fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >{isExpanded ? '접기' : `내역${cardTotal > 0 ? ' ' + formatCurrency(cardTotal) : ''}`}</button>
                  <button onClick={() => deleteCard(card.id)} style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                </div>
              </div>
              {isExpanded && (
                <div style={{ background: '#f9fafb', borderRadius: '0 0 10px 10px', padding: '8px 12px', marginBottom: 4 }}>
                  {cardExpenses.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>이 카드로 결제한 내역이 없어요</p>
                  ) : (
                    cardExpenses.map(e => (
                      <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{e.name}</p>
                          <p style={{ fontSize: 10, color: '#9ca3af' }}>{e.date.slice(5)} · {e.category}</p>
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#f87171' }}>-{formatCurrency(Number(e.amount))}</span>
                      </div>
                    ))
                  )}
                  {cardExpenses.length > 0 && (
                    <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-primary)', marginTop: 6, textAlign: 'right' }}>
                      이번달 합계 {formatCurrency(cardTotal)}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
        <button onClick={() => setShowAddCard(s => !s)} style={fullAddBtn}>+ 카드 추가</button>
      </Section>

      {/* 5. 고정비 */}
      <Section icon="" title="고정비" summary={`월 ${formatCurrency(fixedExpenseTotal)} 지출`}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>고정 지출</span>
            <button onClick={() => setShowAddFixed(showAddFixed === 'expense' ? null : 'expense')} style={addBtnStyle('var(--color-primary)', 'var(--color-primary-light)')}>+ 추가</button>
          </div>
          {showAddFixed === 'expense' && (
            <InlineForm
              fields={[
                { label: '이름', key: 'name', placeholder: '예) 넷플릭스' },
                { label: '금액', key: 'amount', type: 'number', placeholder: '0' },
                { label: '빠져나가는 날', key: 'due_day', placeholder: '예) 25' },
                { label: '연결 계좌/카드', key: 'linked_account_id', options: linkedOptions },
              ]}
              onSave={v => addFixed(v, '고정지출')}
              onCancel={() => setShowAddFixed(null)} />
          )}
          {fixedExpenses.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>고정 지출이 없어요</p>}
          {fixedExpenses.map(f => <FixedRow key={f.id} item={f}
            accountName={localAccounts.find(a => a.id === (f as any).linked_account_id)?.name}
            onDelete={() => deleteFixed(f.id)}
            onEdit={(u: Record<string, unknown>) => editFixed(f.id, u)} />)}
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 600 }}>소계 {formatCurrency(fixedExpenseTotal)}</p>
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>고정 저축</span>
            <button onClick={() => setShowAddFixed(showAddFixed === 'saving' ? null : 'saving')} style={addBtnStyle('#059669', '#f0fdf4')}>+ 추가</button>
          </div>
          {showAddFixed === 'saving' && (
            <InlineForm
              fields={[
                { label: '이름', key: 'name', placeholder: '예) 석열 적금' },
                { label: '금액', key: 'amount', type: 'number', placeholder: '0' },
                { label: '빠져나가는 날', key: 'due_day', placeholder: '예) 5' },
                { label: '출금 계좌 (돈이 나가는 곳)', key: 'linked_account_id', options: linkedOptions },
                { label: '입금 계좌 (적금 계좌)', key: 'linked_target_account_id', options: linkedOptions },
              ]}
              onSave={v => addFixed(v, '고정저축')}
              onCancel={() => setShowAddFixed(null)} />
          )}
          {fixedSavings.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>고정 저축이 없어요</p>}
          {fixedSavings.map(f => <FixedRow key={f.id} item={f}
            accountName={localAccounts.find(a => a.id === (f as any).linked_account_id)?.name}
            targetAccountName={localAccounts.find(a => a.id === (f as any).linked_target_account_id)?.name}
            onDelete={() => deleteFixed(f.id)}
            onEdit={(u: Record<string, unknown>) => editFixed(f.id, u)} />)}
          <p style={{ fontSize: 12, color: '#059669', marginTop: 6, fontWeight: 600 }}>소계 {formatCurrency(fixedSavingTotal)}</p>
        </div>
      </Section>
    </div>

    {/* 카드 납부 기록 토스트 */}
    {cardPayToast && (
      <div style={{
        position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
        background: '#1f2937', color: '#fff', padding: '10px 18px',
        borderRadius: 20, fontSize: 13, zIndex: 9999, whiteSpace: 'nowrap' as const,
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      }}>{cardPayToast}</div>
    )}

    {/* 카드 납부 기록 바텀시트 */}
    {cardPaySheet && (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-end' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setCardPaySheet(null)} />
        <div style={{
          position: 'relative', width: '100%', background: '#fff',
          borderRadius: '20px 20px 0 0', padding: '24px 20px 48px',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
          </div>
          <p style={{ fontSize: 16, fontWeight: 700, color: '#1f2937', marginBottom: 4 }}>
            {cardPaySheet.name} 납부 기록
          </p>
          <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 20 }}>
            매월 {cardPaySheet.due_day}일 납부
          </p>
          <div style={{ background: '#fefce8', borderRadius: 12, padding: '10px 14px', marginBottom: 20, border: '1px solid #fde68a' }}>
            <p style={{ fontSize: 12, color: '#92400e' }}>
              💡 카드사 앱에서 이번 달 청구 금액을 확인해보세요
            </p>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>납부 금액 *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15, color: '#374151', fontWeight: 700 }}>₩</span>
              <input
                type="text" inputMode="numeric" placeholder="0"
                value={cardPayAmount}
                onChange={e => {
                  const n = e.target.value.replace(/[^0-9]/g, '')
                  setCardPayAmount(n ? Number(n).toLocaleString() : '')
                  setCardPayAmountErr(false)
                }}
                autoFocus
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  border: `1.5px solid ${cardPayAmountErr ? '#ef4444' : '#e5e7eb'}`,
                  fontSize: 15, fontWeight: 600, outline: 'none',
                  fontFamily: 'inherit', background: '#fafafa',
                }}
              />
            </div>
            {cardPayAmountErr && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>금액을 입력해주세요</p>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>납부일</label>
            <input type="date" value={cardPayDate}
              onChange={e => setCardPayDate(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1.5px solid #e5e7eb', fontSize: 14,
                outline: 'none', fontFamily: 'inherit', background: '#fafafa',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>메모 (선택)</label>
            <input type="text" placeholder="간단히 남겨보세요"
              value={cardPayMemo} onChange={e => setCardPayMemo(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1.5px solid #e5e7eb', fontSize: 14,
                outline: 'none', fontFamily: 'inherit', background: '#fafafa',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setCardPaySheet(null)}
              style={{
                flex: 1, padding: '14px', borderRadius: 14,
                background: '#f3f4f6', color: '#374151',
                border: 'none', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
            <button onClick={saveCardPayment} disabled={cardPaySaving}
              style={{
                flex: 1, padding: '14px', borderRadius: 14, border: 'none',
                background: cardPaySaving ? '#d1d5db' : 'var(--color-primary)', color: '#fff',
                fontSize: 14, fontWeight: 700,
                cursor: cardPaySaving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}>
              {cardPaySaving ? '기록 중...' : '기록하기'}
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  )
}

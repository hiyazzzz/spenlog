'use client'
import React, { useState, useEffect } from 'react'
import { TEXTS } from '@/config/texts'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import CategoryManager from './CategoryManager'
import RoutineBanner from './RoutineBanner'
import { Account, Card, FixedCost, AccountType } from '@spenlog/types'
import { formatCurrency } from '@/lib/format'
import dayjs from 'dayjs'
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
  fields: { label: string; key: string; type?: string; options?: string[]; placeholder?: string; hint?: string }[]
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
          {f.hint && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>{f.hint}</p>}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(vals)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>저장</button>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
}

function FixedRow({ item, accountName, targetAccountName, onDelete, onEdit, isEditing, onStartEdit, onClose, accounts = [], cards = [] }: {
  item: FixedCost; accountName?: string; targetAccountName?: string
  onDelete: () => Promise<void>; onEdit: (updates: Record<string, unknown>) => Promise<void>
  isEditing: boolean; onStartEdit: () => void; onClose: () => void
  accounts?: Account[]; cards?: Card[]
}) {
  const [vals, setVals] = useState({ name: item.name, amount: fmt(String(item.amount)), due_day: String((item as any).due_day ?? '') })
  const kind = (item as any).kind ?? '고정지출'
  const isGreen = kind === '고정저축'
  const [editLinkedAccountId, setEditLinkedAccountId] = useState<string>((item as any).linked_account_id ?? '')
  const [editLinkedCardId, setEditLinkedCardId] = useState<string>((item as any).linked_card_id ?? '')
  const [editDebitAccountId, setEditDebitAccountId] = useState<string>((item as any).linked_account_id ?? '')
  const [editCreditAccountId, setEditCreditAccountId] = useState<string>((item as any).linked_target_account_id ?? '')

  useEffect(() => {
    if (isEditing) {
      setVals({ name: item.name, amount: fmt(String(item.amount)), due_day: String((item as any).due_day ?? '') })
      setEditLinkedAccountId((item as any).linked_account_id ?? '')
      setEditLinkedCardId((item as any).linked_card_id ?? '')
      setEditDebitAccountId((item as any).linked_account_id ?? '')
      setEditCreditAccountId((item as any).linked_target_account_id ?? '')
    }
  }, [isEditing])

  const selStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb',
    fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#fafafa',
    boxSizing: 'border-box' as const,
  }
  const labelStyle: React.CSSProperties = { fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 3 }
  const inpStyle: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }

  if (isEditing) {
    return (
      <div style={{ padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <label style={labelStyle}>이름</label>
            <input value={vals.name} onChange={e => setVals(p => ({ ...p, name: e.target.value }))}
              style={inpStyle} placeholder="예) 넷플릭스" />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>금액</label>
              <input value={vals.amount} inputMode="numeric"
                onChange={e => setVals(p => ({ ...p, amount: fmt(e.target.value) }))}
                style={inpStyle} placeholder="0" />
            </div>
            <div style={{ width: 72 }}>
              <label style={labelStyle}>출금일</label>
              <input value={vals.due_day} inputMode="numeric"
                onChange={e => setVals(p => ({ ...p, due_day: e.target.value.replace(/[^0-9]/g, '') }))}
                style={inpStyle} placeholder="일" />
            </div>
          </div>
          {isGreen ? (
            <>
              <label style={labelStyle}>출금 계좌 (돈이 나가는 곳)</label>
              <select value={editDebitAccountId} onChange={e => setEditDebitAccountId(e.target.value)} style={selStyle}>
                <option value="">선택 안 함</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
              </select>
              <label style={labelStyle}>입금 계좌 (적금 계좌)</label>
              <select value={editCreditAccountId} onChange={e => setEditCreditAccountId(e.target.value)} style={selStyle}>
                <option value="">선택 안 함</option>
                {accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({a.bank})</option>)}
              </select>
            </>
          ) : (
            <>
              <label style={labelStyle}>연결 계좌/카드</label>
              <select
                value={editLinkedCardId ? editLinkedCardId + '|card' : editLinkedAccountId ? editLinkedAccountId + '|account' : ''}
                onChange={e => {
                  const v = e.target.value
                  if (!v) { setEditLinkedAccountId(''); setEditLinkedCardId(''); }
                  else if (v.endsWith('|account')) { setEditLinkedAccountId(v.replace('|account', '')); setEditLinkedCardId(''); }
                  else { setEditLinkedCardId(v.replace('|card', '')); setEditLinkedAccountId(''); }
                }}
                style={selStyle}
              >
                <option value="">선택 안 함</option>
                {accounts.map(a => <option key={a.id} value={a.id + '|account'}>{a.name} (계좌)</option>)}
                {cards.map(c => <option key={c.id} value={c.id + '|card'}>{c.name} (카드)</option>)}
              </select>
            </>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => {
              const updates: Record<string, unknown> = {
                name: vals.name,
                amount: parse(vals.amount),
                due_day: parseInt(vals.due_day) || null,
              }
              if (isGreen) {
                updates.linked_account_id = editDebitAccountId || null
                updates.linked_target_account_id = editCreditAccountId || null
                updates.linked_card_id = null
              } else {
                updates.linked_account_id = editLinkedCardId ? null : (editLinkedAccountId || null)
                updates.linked_card_id = editLinkedCardId || null
                updates.linked_target_account_id = null
              }
              onEdit(updates)
              onClose()
            }}
              style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
            <button onClick={onClose}
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
        <button onClick={onStartEdit} style={{ fontSize: 11, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
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


function AccountRow({ acc, sb, onDelete, onUpdated, isEditing, onStartEdit, onClose }: {
  acc: Account
  sb: ReturnType<typeof createClient>
  onDelete: () => void
  onUpdated: (u: Account) => void
  isEditing: boolean; onStartEdit: () => void; onClose: () => void
}) {
  const ACCT_TYPES: AccountType[] = ['입출금', '적금', '투자', '기타']
  const [vals, setVals] = useState({ name: acc.name, bank: acc.bank, type: acc.type ?? '입출금', balance: fmt(String(acc.balance ?? 0)) })
  const [sav, setSav] = useState(false)
  useEffect(() => {
    if (isEditing) setVals({ name: acc.name, bank: acc.bank, type: acc.type ?? '입출금', balance: fmt(String(acc.balance ?? 0)) })
  }, [isEditing])
  const inp: React.CSSProperties = { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const }
  const lbl: React.CSSProperties = { fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 3, marginTop: 6 }
  if (isEditing) return (
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f9fafb' }}>
      <label style={{ ...lbl, marginTop: 0 }}>계좌명</label>
      <input value={vals.name} onChange={e => setVals(p => ({ ...p, name: e.target.value }))} placeholder="예) 국민 주거래통장" style={inp} />
      <label style={lbl}>은행</label>
      <input value={vals.bank} onChange={e => setVals(p => ({ ...p, bank: e.target.value }))} placeholder="예) KB국민" style={inp} />
      <label style={lbl}>잔액</label>
      <input value={vals.balance} onChange={e => setVals(p => ({ ...p, balance: fmt(e.target.value) }))} inputMode="numeric" placeholder="0" style={inp} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' as const, margin: '8px 0' }}>
        {ACCT_TYPES.map(t => (
          <button key={t} onClick={() => setVals(p => ({ ...p, type: t as AccountType }))}
            style={{ padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 12,
              background: vals.type === t ? 'var(--color-primary)' : '#f3f4f6', color: vals.type === t ? '#fff' : '#6b7280' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button disabled={sav} onClick={async () => {
          setSav(true)
          const { error } = await sb.from('accounts').update({ name: vals.name.trim(), bank: vals.bank.trim(), type: vals.type, balance: parse(vals.balance) }).eq('id', acc.id)
          setSav(false)
          if (!error) { onUpdated({ ...acc, name: vals.name.trim(), bank: vals.bank.trim(), type: vals.type as any, balance: parse(vals.balance) }); onClose() }
        }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{sav ? '저장 중...' : '저장'}</button>
        <button onClick={onClose} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f9fafb' }}>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#1f2937' }}>{acc.name}</p>
        <p style={{ fontSize: 11, color: '#9ca3af' }}>{acc.bank} · {acc.type}</p>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-accent)' }}>{formatCurrency(acc.balance ?? 0)}</span>
        <button onClick={onStartEdit} style={{ fontSize: 11, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>수정</button>
        <button onClick={onDelete} style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
      </div>
    </div>
  )
}

function getCardBillingPeriod(card: Card, targetMonth: string): { start: string; end: string } {
  if (!card.billing_start_day || card.billing_start_day === 1) {
    const start = `${targetMonth}-01`
    const end = dayjs(start).endOf("month").format("YYYY-MM-DD")
    return { start, end }
  }
  const startDay = card.billing_start_day
  const prevMonth = dayjs(`${targetMonth}-01`).subtract(1, "month")
  const start = prevMonth.format("YYYY-MM") + "-" + String(startDay).padStart(2, "0")
  const endDay = startDay - 1
  const end = endDay === 0
    ? dayjs(`${targetMonth}-01`).subtract(1, "day").format("YYYY-MM-DD")
    : `${targetMonth}-${String(endDay).padStart(2, "0")}`
  return { start, end }
}

export default function AssetsClient({ profile, userId, accounts, cards, fixedCosts, budgets, thisMonthSpent, categorySpent, thisMonth, customCategories, expenses = [] }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [localAccounts, setLocalAccounts] = useState(accounts)
  const [localCards, setLocalCards] = useState(cards)
  const [localFixed, setLocalFixed] = useState(fixedCosts)
  const [localBudgets, setLocalBudgets] = useState(budgets)
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(() => {
    // localStorage로 먼저 방어 (DB 업데이트 실패해도 재노출 방지)
    if (typeof window !== 'undefined' && localStorage.getItem('spenlog_asset_banner_dismissed') === 'true') return false
    return !!(profile?.asset_setup_skipped && !profile?.asset_setup_completed)
  })
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showCashForm, setShowCashForm] = useState(false)
  const [cashBalance, setCashBalance] = useState('')
  const [showAddCard, setShowAddCard] = useState(false)
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)
  const [showAddFixed, setShowAddFixed] = useState<'expense' | 'saving' | null>(null)
  const [activeEditId, setActiveEditId] = useState<string | null>(null)
  const editingIncome = activeEditId === 'income'
  const editingCardId = activeEditId?.startsWith('card:') ? activeEditId.slice(5) : null
  // 카드 납부 기록 바텀시트
  const [cardPaySheet, setCardPaySheet] = useState<Card | null>(null)
  const [cardSectionExpanded, setCardSectionExpanded] = useState(false)
  const [cardPayAmount, setCardPayAmount] = useState('')
  const [cardPayDate, setCardPayDate] = useState('')
  const [cardPayMemo, setCardPayMemo] = useState('')
  const [cardPayAmountErr, setCardPayAmountErr] = useState(false)
  const [cardPaySaving, setCardPaySaving] = useState(false)
  const [cardPayMonth, setCardPayMonth] = useState('')
  const [cardPaidIds, setCardPaidIds] = useState<Set<string>>(new Set())
  const [cardPayToast, setCardPayToast] = useState('')
  // 카드 수정 인라인 상태 (activeEditId로 통합 관리)
  const [cardEditName, setCardEditName] = useState('')
  const [cardEditBank, setCardEditBank] = useState('')
  const [cardEditDueDay, setCardEditDueDay] = useState('')
  const [cardEditBillingStart, setCardEditBillingStart] = useState('')
  const [cardEditLinkedAccountId, setCardEditLinkedAccountId] = useState('')
  const [cardEditSaving, setCardEditSaving] = useState(false)

  // 이번 달 카드 납부 완료 목록 초기 로딩 (savings_payments 테이블 기준)
  useEffect(() => {
    async function loadPaidCards() {
      const { data } = await supabase
        .from('savings_payments')
        .select('card_id')
        .eq('user_id', userId)
        .eq('year_month', thisMonth)
        .eq('is_paid', true)
        .not('card_id', 'is', null)
      if (data) {
        setCardPaidIds(new Set(data.map((p: { card_id: string }) => p.card_id).filter(Boolean)))
      }
    }
    loadPaidCards()
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
    const todayDay = today.getDate()
    const due = card.due_day

    if (cardPaidIds.has(card.id)) return { label: '✓ 완료', color: '#10b981', isToday: false }

    const diff = due - todayDay
    if (diff === 0) return { label: '오늘 납부일 ⚠️', color: '#f59e0b', isToday: true }
    if (diff < 0) {
      // 등록 월이 이번 달이면 지연 뱃지 미표시 (다음 달부터 적용)
      if (card.created_at) {
        const cardDate = new Date(card.created_at)
        const cardYearMonth = cardDate.getFullYear() * 100 + (cardDate.getMonth() + 1)
        const thisYearMonth = today.getFullYear() * 100 + (today.getMonth() + 1)
        if (cardYearMonth >= thisYearMonth) return { label: '', color: '#9ca3af', isToday: false }
      }
      return { label: '지연 ⚠️', color: '#ef4444', isToday: false }
    }
    return { label: `D-${diff}`, color: '#9ca3af', isToday: false }
  }

  function openCardPaySheet(card: Card) {
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    // 기본: 전월 (7월 3일에 6월 카드값 납부하는 케이스)
    const prevMonth = today.getMonth() === 0
      ? `${today.getFullYear() - 1}-12`
      : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, '0')}`
    setCardPaySheet(card)
    setCardPayMonth(prevMonth)
    setCardPayDate(`${yyyy}-${mm}-${dd}`)
    setCardPayMemo('')
    setCardPayAmountErr(false)
    const billingPeriod = getCardBillingPeriod(card, prevMonth)
    const total = expenses
      .filter(e => e.payment_method === card.name && e.date >= billingPeriod.start && e.date <= billingPeriod.end)
      .reduce((s, e) => s + Number(e.amount), 0)
    setCardPayAmount(total > 0 ? String(total) : '')
  }

  function selectCardPayMonth(card: Card, month: string) {
    setCardPayMonth(month)
    const billingPeriod = getCardBillingPeriod(card, month)
    const total = expenses
      .filter(e => e.payment_method === card.name && e.date >= billingPeriod.start && e.date <= billingPeriod.end)
      .reduce((s, e) => s + Number(e.amount), 0)
    setCardPayAmount(total > 0 ? String(total) : '')
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

    // 연결 계좌 잔액 차감
    if (cardPaySheet.linked_account) {
      const { data: acc } = await supabase
        .from('accounts')
        .select('balance')
        .eq('id', cardPaySheet.linked_account)
        .single()
      if (acc != null) {
        const newBalance = (acc.balance ?? 0) - amount
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', cardPaySheet.linked_account)
      }
    }

    // Record to savings_payments for completion tracking
    await supabase.from('savings_payments').upsert({
      user_id: userId,
      fixed_cost_id: null,
      card_id: cardPaySheet.id,
      year_month: cardPayMonth || thisMonth,
      amount: amount,
      is_paid: true,
      paid_at: new Date().toISOString(),
    }, { onConflict: 'user_id,year_month,card_id' })

    setCardPaidIds(s => new Set([...s, cardPaySheet!.id]))
    setCardPaySaving(false)
    setCardPaySheet(null)
    setCardPayToast(TEXTS.assets.cardPaySheet.toast)
    setTimeout(() => setCardPayToast(''), 2500)
    router.refresh()
  }

  const [incomeError, setIncomeError] = useState('')

  async function saveIncome() {
    setIncomeError('')
    const { error } = await supabase.from('users').update({ income: parse(income), saving_goal: parse(savingGoal) }).eq('id', userId)
    if (error) {
      setIncomeError('저장 실패: ' + error.message)
      return
    }
    setActiveEditId(null)
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
      billing_start_day: parseInt(vals.billing_start_day) || null,
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
    // linkedOptions 형식: "id|account|라벨" or "id|card|라벨"
    const parseLinked = (raw: string): { accountId: string | null; cardId: string | null } => {
      if (!raw) return { accountId: null, cardId: null }
      const parts = raw.split('|')
      const id = parts[0] || null
      const type = parts[1]
      if (type === 'card') return { accountId: null, cardId: id }
      return { accountId: id, cardId: null }
    }
    const linked = parseLinked(vals.linked_account_id || '')
    const linkedTarget = parseLinked(vals.linked_target_account_id || '')

    const insertPayload: Record<string, unknown> = {
      user_id: userId, name: vals.name, amount: parse(vals.amount),
      kind, due_day: parseInt(vals.due_day) || null, type: '월정액',
      linked_account_id: linked.accountId,
      linked_target_account_id: linkedTarget.accountId || null,
    }
    if (linked.cardId) insertPayload.linked_card_id = linked.cardId

    const { data, error } = await supabase.from('fixed_costs').insert(insertPayload).select().single()
    if (error) {
      console.error('[addFixed] insert error:', error.code, error.message)
      return
    }
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

      {/* 자산 온보딩 재유도 배너 */}
      {showOnboardingBanner && (
        <div style={{
          background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent) 100%)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div
            style={{ flex: 1, textAlign: 'left', padding: 0 }}
          >
            <p style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{TEXTS.assets.bannerTitle}</p>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)' }}>{TEXTS.assets.bannerDesc}</p>
          </div>
          <button onClick={() => {
            setShowOnboardingBanner(false)
            // localStorage에 저장 (DB 업데이트 실패해도 재노출 방지)
            if (typeof window !== 'undefined') localStorage.setItem('spenlog_asset_banner_dismissed', 'true')
            supabase.from('users').update({ asset_setup_skipped: false }).eq('id', userId).then(({ error }) => {
              if (error) console.error('asset_setup_skipped update error:', error)
            })
          }} style={{
            background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 20,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff', fontSize: 14, flexShrink: 0,
          }}>✕</button>
        </div>
      )}

      <h1 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-accent)' }}>{TEXTS.assets.title}</h1>

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

      {/* 0-1. 이번 달 카드 납부 */}
      {localCards.length > 0 && (() => {
        const cardsDone = localCards.filter(c => cardPaidIds.has(c.id)).length
        return (
          <div style={{
            background: '#fff',
            border: '1px solid #f3f4f6',
            borderRadius: 16, padding: '14px 16px', marginBottom: 12,
            boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
          }}>
            <button onClick={() => setCardSectionExpanded(e => !e)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', marginBottom: cardSectionExpanded ? 10 : 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>이번 달 카드 납부</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <p style={{ fontSize: 12, color: '#9ca3af' }}>{cardsDone}/{localCards.length} 완료</p>
                <span style={{ fontSize: 14, color: '#9ca3af', transform: cardSectionExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', display: 'inline-block' }}>▼</span>
              </div>
            </button>
            {cardSectionExpanded && localCards.map(card => {
              const payStatus = getCardPayStatus(card)
              const paid = cardPaidIds.has(card.id)
              return (
                <div key={card.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 0', borderBottom: '1px solid #f3f4f6',
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: paid ? '#9ca3af' : '#1f2937' }}>{card.name}</p>
                    <p style={{ fontSize: 11, color: '#9ca3af' }}>
                      {card.bank}{card.due_day ? ' · 납부일 매월 ' + card.due_day + '일' : ''}
                    </p>
                    {payStatus.label && (
                      <span style={{ fontSize: 10, fontWeight: 700, color: payStatus.color, background: payStatus.color + '18', padding: '2px 7px', borderRadius: 10, display: 'inline-block', marginTop: 2 }}>
                        {payStatus.label}
                      </span>
                    )}
                  </div>
                  {paid ? (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#10b981' }}>✓ 완료</span>
                  ) : (
                    <button
                      onClick={() => openCardPaySheet(card)}
                      style={{ fontSize: 11, color: payStatus.isToday ? '#f59e0b' : '#6b7280', background: payStatus.isToday ? '#fffbeb' : '#f9fafb', border: `1px solid ${payStatus.isToday ? '#fde68a' : '#e5e7eb'}`, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                    >납부 기록</button>
                  )}
                </div>
              )
            })}
            )}
          </div>
        )
      })()}

      {/* 1. 월 수입 */}
      <Section icon="" title="월 수입" summary={monthlyIncome > 0 ? formatCurrency(monthlyIncome) : '미설정'} defaultOpen={!monthlyIncome}>
        {!editingIncome ? (
          <div>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)', marginBottom: 8 }}>{formatCurrency(monthlyIncome)}</p>
            {profile?.saving_goal > 0 && <p style={{ fontSize: 12, color: '#6b7280' }}>저축 목표 {formatCurrency(Number(profile.saving_goal))}</p>}
            <button onClick={() => setActiveEditId('income')} style={{ marginTop: 10, fontSize: 12, color: 'var(--color-primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>✏️ 수정</button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{TEXTS.assets.incomeLabel}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="text" inputMode="numeric" value={income}
                  onChange={e => setIncome(fmt(e.target.value))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fafafa', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 14, color: '#6b7280' }}>원</span>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{TEXTS.assets.savingGoalLabel}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input type="text" inputMode="numeric" value={savingGoal}
                  onChange={e => setSavingGoal(fmt(e.target.value))}
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fafafa', fontSize: 14, outline: 'none', fontFamily: 'inherit' }} />
                <span style={{ fontSize: 14, color: '#6b7280' }}>원</span>
              </div>
            </div>
            {incomeError && <p style={{ fontSize: 12, color: '#ef4444', marginBottom: 8 }}>{incomeError}</p>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={saveIncome} style={{ flex: 1, padding: '10px', borderRadius: 10, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.assets.btnSave}</button>
              <button onClick={() => setActiveEditId(null)} style={{ flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{TEXTS.assets.btnCancel}</button>
            </div>
          </div>
        )}
      </Section>

      {/* 2. 예산 — /budget 페이지로 이동 */}
      <button
        onClick={() => router.push('/budget')}
        style={{
          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: '#fff', border: '1px solid #f3f4f6', borderRadius: 16,
          padding: '18px 16px', cursor: 'pointer', fontFamily: 'inherit',
          boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 10,
        }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{TEXTS.assets.sectionBudget}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, color: totalBudget > 0 ? 'var(--color-accent)' : '#9ca3af' }}>
            {totalBudget > 0 ? TEXTS.assets.budgetSet(totalBudget) : TEXTS.assets.budgetNotSet}
          </span>
          <span style={{ fontSize: 16, color: '#9ca3af' }}>›</span>
        </div>
      </button>

      {/* 3. 계좌/현금 */}
      <Section icon="" title={TEXTS.assets.sectionAccount} summary={TEXTS.assets.totalBalance(totalBalance)}>
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
        {localAccounts.length === 0 && !showAddAccount && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>{TEXTS.assets.noAccounts}</p>}
        {localAccounts.map(acc => (
          <AccountRow key={acc.id} acc={acc} sb={supabase}
            onDelete={() => deleteAccount(acc.id)}
            onUpdated={updated => setLocalAccounts(prev => prev.map(a => a.id === updated.id ? updated : a))}
            isEditing={activeEditId === 'account:' + acc.id}
            onStartEdit={() => setActiveEditId('account:' + acc.id)}
            onClose={() => setActiveEditId(null)} />
        ))}
        {showCashForm ? (
          <div style={{ marginTop: 8, padding: '14px', background: '#f0fdf4', borderRadius: 12, border: '1px solid #bbf7d0' }}>
            <p style={{ fontSize: 12, fontWeight: 700, color: '#065f46', marginBottom: 10 }}>{TEXTS.assets.cashForm.title}</p>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text" inputMode="numeric" autoFocus
                  placeholder={TEXTS.assets.cashForm.placeholder}
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
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: '#9ca3af' }}>{TEXTS.assets.cashForm.suffix}</span>
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
              >{TEXTS.assets.cashForm.btnAdd}</button>
              <button
                onClick={() => { setShowCashForm(false); setCashBalance('') }}
                style={{
                  padding: '10px 12px', borderRadius: 10,
                  border: '1.5px solid #d1fae5', background: '#fff',
                  fontSize: 12, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit',
                }}
              >{TEXTS.assets.cashForm.btnCancel}</button>
            </div>
          </div>
        ) : null}
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => { setShowCashForm(s => !s); setShowAddAccount(false) }}
            style={{ ...fullAddBtn, flex: 1, background: '#f0fdf4', color: '#059669' }}
          >{TEXTS.assets.btnAddCash}</button>
          <button onClick={() => { setShowAddAccount(s => !s); setShowCashForm(false) }} style={{ ...fullAddBtn, flex: 1 }}>{TEXTS.assets.btnAddAccount}</button>
        </div>
      </Section>

      {/* 4. 카드 */}
      <Section icon="" title={TEXTS.assets.sectionCard} summary={localCards.length > 0 ? TEXTS.assets.cardCount(localCards.length) : TEXTS.assets.cardNone}>
        {showAddCard && (
          <InlineForm
            fields={[
              { label: '카드명', key: 'name', placeholder: '예) 신한카드' },
              { label: '카드사', key: 'bank', placeholder: '예) 신한' },
              { label: '대금 출금일', key: 'due_day', placeholder: '예) 15' },
              { label: '청구 시작일 (선택)', key: 'billing_start_day', placeholder: '없음', type: 'number', hint: '미입력 시 매월 1일 기준' },
              { label: '연결 계좌/카드', key: 'linked_account_id', options: linkedOptions },
            ]}
            onSave={addCard}
            onCancel={() => setShowAddCard(false)} />
        )}
        {localCards.length === 0 && !showAddCard && <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 10 }}>{TEXTS.assets.noCards}</p>}
        {localCards.map(card => {
          const billingPeriod = getCardBillingPeriod(card, thisMonth)
          const cardExpenses = expenses.filter(e =>
            e.payment_method === card.name &&
            e.date >= billingPeriod.start &&
            e.date <= billingPeriod.end
          )
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
                  {cardTotal > 0 && !cardPaidIds.has(card.id) && (
                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                      예상 대금 <strong style={{ color: '#1f2937' }}>{formatCurrency(cardTotal)}</strong>
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    onClick={() => setExpandedCardId(isExpanded ? null : card.id)}
                    style={{ fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                  >{isExpanded ? '접기' : `내역${cardTotal > 0 ? ' ' + formatCurrency(cardTotal) : ''}`}</button>
                  <button onClick={() => {
                    if (editingCardId === card.id) { setActiveEditId(null); return }
                    setShowAddCard(false); setActiveEditId('card:' + card.id)
                    setCardEditName(card.name); setCardEditBank(card.bank ?? '')
                    setCardEditDueDay(card.due_day ? String(card.due_day) : '')
                    setCardEditBillingStart(card.billing_start_day ? String(card.billing_start_day) : '')
                    setCardEditLinkedAccountId(card.linked_account_id ?? '')
                  }} style={{ fontSize: 11, color: 'var(--color-primary-mid)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {editingCardId === card.id ? '닫기' : '수정'}
                  </button>
                  <button onClick={() => deleteCard(card.id)} style={{ fontSize: 11, color: '#ef4444', background: '#fef2f2', border: 'none', padding: '3px 8px', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>삭제</button>
                </div>
              </div>
              {editingCardId === card.id && (
                <div style={{ background: '#f9fafb', borderRadius: 10, padding: 12, marginBottom: 6, border: '1px solid #e5e7eb' }}>
                  {([['name', '카드명', false], ['bank', '카드사', false], ['dueDay', '대금 출금일', true], ['billingStart', '청구 시작일 (선택)', true]] as [string, string, boolean][]).map(([key, label, numeric]) => {
                    const val = key === 'name' ? cardEditName : key === 'bank' ? cardEditBank : key === 'dueDay' ? cardEditDueDay : cardEditBillingStart
                    const setter = key === 'name' ? setCardEditName : key === 'bank' ? setCardEditBank : key === 'dueDay' ? setCardEditDueDay : setCardEditBillingStart
                    return (
                      <div key={key} style={{ marginBottom: 6 }}>
                        <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 3 }}>{label}</label>
                        <input value={val} onChange={e => setter(numeric ? e.target.value.replace(/[^0-9]/g, '') : e.target.value)}
                          placeholder={key === 'billingStart' ? '미입력 시 매달 1일 기준' : label} inputMode={numeric ? 'numeric' : undefined}
                          style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, display: 'block' }} />
                      </div>
                    )
                  })}
                  <div style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 3 }}>연결 계좌/카드</label>
                    <select value={cardEditLinkedAccountId} onChange={e => setCardEditLinkedAccountId(e.target.value)}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: '1.5px solid #e5e7eb', fontSize: 13, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, display: 'block', background: '#fff' }}>
                      <option value="">선택</option>
                      {localAccounts.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button disabled={cardEditSaving} onClick={async () => {
                      setCardEditSaving(true)
                      const updates: Record<string, any> = {
                        name: cardEditName.trim(),
                        bank: cardEditBank.trim(),
                        due_day: cardEditDueDay ? parseInt(cardEditDueDay) : null,
                        billing_start_day: cardEditBillingStart ? parseInt(cardEditBillingStart) : null,
                        linked_account_id: cardEditLinkedAccountId || null,
                      }
                      const { error } = await supabase.from('cards').update(updates).eq('id', card.id)
                      setCardEditSaving(false)
                      if (!error) { setLocalCards(prev => prev.map(cd => cd.id === card.id ? { ...cd, ...updates } : cd)); setActiveEditId(null) }
                    }} style={{ flex: 1, padding: '8px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>{cardEditSaving ? '저장 중...' : '저장'}</button>
                    <button onClick={() => setActiveEditId(null)} style={{ flex: 1, padding: '8px', borderRadius: 8, border: '1.5px solid #e5e7eb', background: '#fff', color: '#6b7280', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
                  </div>
                </div>
              )}
              {isExpanded && (
                <div style={{ background: '#f9fafb', borderRadius: '0 0 10px 10px', padding: '8px 12px', marginBottom: 4 }}>
                  {cardExpenses.length === 0 ? (
                    <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '8px 0' }}>{TEXTS.assets.cardNoExpense}</p>
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
        <button onClick={() => { setShowAddCard(s => !s); setActiveEditId(null) }} style={fullAddBtn}>{TEXTS.assets.btnAddCard}</button>
      </Section>

      {/* 5. 고정비 */}
      <Section icon="" title={TEXTS.assets.sectionFixed} summary={TEXTS.assets.fixedMonthly(fixedExpenseTotal)}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{TEXTS.assets.fixedSection.expense}</span>
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
          {fixedExpenses.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>{TEXTS.assets.noFixedExpense}</p>}
          {fixedExpenses.map(f => <FixedRow key={f.id} item={f}
            accountName={localAccounts.find(a => a.id === (f as any).linked_account_id)?.name}
            onDelete={() => deleteFixed(f.id)}
            onEdit={(u: Record<string, unknown>) => editFixed(f.id, u)}
            isEditing={activeEditId === 'fixed:' + f.id}
            onStartEdit={() => setActiveEditId('fixed:' + f.id)}
            onClose={() => setActiveEditId(null)}
            accounts={localAccounts} cards={localCards} />)}
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 600 }}>{TEXTS.assets.fixedSection.subtotal(fixedExpenseTotal)}</p>
        </div>
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>{TEXTS.assets.fixedSection.saving}</span>
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
          {fixedSavings.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>{TEXTS.assets.noFixedSaving}</p>}
          {fixedSavings.map(f => <FixedRow key={f.id} item={f}
            accountName={localAccounts.find(a => a.id === (f as any).linked_account_id)?.name}
            targetAccountName={localAccounts.find(a => a.id === (f as any).linked_target_account_id)?.name}
            onDelete={() => deleteFixed(f.id)}
            onEdit={(u: Record<string, unknown>) => editFixed(f.id, u)}
            isEditing={activeEditId === 'fixed:' + f.id}
            onStartEdit={() => setActiveEditId('fixed:' + f.id)}
            onClose={() => setActiveEditId(null)}
            accounts={localAccounts} cards={localCards} />)}
          <p style={{ fontSize: 12, color: '#059669', marginTop: 6, fontWeight: 600 }}>{TEXTS.assets.fixedSection.subtotalSaving(fixedSavingTotal)}</p>
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
          {/* 납부 월 안내 */}
          <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 10, textAlign: 'center' }}>
            최근 3개월 내역을 확인하고 납부 기록할 수 있어요
          </p>
          {/* 월 칩 선택 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[-2, -1, 0].map(offset => {
              const now = new Date()
              const d = new Date(now.getFullYear(), now.getMonth() + offset, 1)
              const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
              const label = `${d.getMonth() + 1}월분`
              const active = cardPayMonth === m
              return (
                <button key={m} onClick={() => selectCardPayMonth(cardPaySheet!, m)}
                  style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: active ? 'none' : '1px solid #e5e7eb',
                    background: active ? 'var(--color-primary, #7c3aed)' : '#f9fafb',
                    fontSize: 13, fontWeight: 600, color: active ? '#fff' : '#6b7280', cursor: 'pointer' }}>
                  {label}
                </button>
              )
            })}
          </div>
          <div style={{ background: '#fefce8', borderRadius: 12, padding: '10px 14px', marginBottom: 20, border: '1px solid #fde68a' }}>
            <p style={{ fontSize: 12, color: '#92400e' }}>
              💡 카드사 앱에서 {cardPayMonth ? `${parseInt(cardPayMonth.split('-')[1])}월` : '이번 달'} 청구 금액을 확인해보세요
            </p>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>{TEXTS.assets.cardPaySheet.labelAmount}</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 14, color: '#6b7280' }}>납부금액</span>
              <input
                type="text" inputMode="numeric" placeholder={TEXTS.assets.cardPaySheet.amountPh}
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
                  fontSize: 16, fontWeight: 600, outline: 'none',
                  fontFamily: 'inherit', background: '#fafafa',
                }}
              />
            </div>
            {cardPayAmountErr && <p style={{ fontSize: 11, color: '#ef4444', marginTop: 4 }}>{TEXTS.assets.cardPaySheet.errAmount}</p>}
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>{TEXTS.assets.cardPaySheet.labelDate}</label>
            <input type="date" value={cardPayDate}
              onChange={e => setCardPayDate(e.target.value)}
              style={{
                width: '100%', padding: '12px', borderRadius: 12,
                border: '1.5px solid #e5e7eb', fontSize: 16,
                outline: 'none', fontFamily: 'inherit', background: '#fafafa',
                boxSizing: 'border-box' as const,
              }}
            />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6, fontWeight: 600 }}>{TEXTS.assets.cardPaySheet.labelMemo}</label>
            <input type="text" placeholder={TEXTS.assets.cardPaySheet.memoPh}
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
              }}>{TEXTS.assets.cardPaySheet.btnCancel}</button>
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

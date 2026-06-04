'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import { Account, Card, FixedCost } from '@/types'

interface Budget { id: string; category: string; amount: number; month: string }

interface Props {
  profile: any
  userId: string
  accounts: Account[]
  cards: Card[]
  fixedCosts: FixedCost[]
  budgets: Budget[]
  thisMonthSpent: number
  categorySpent: Record<string, number>
  thisMonth: string
}

function fmt(v: string) { const n = v.replace(/[^0-9]/g, ''); return n ? Number(n).toLocaleString() : '' }
function parse(v: string) { return parseInt(v.replace(/,/g, '')) || 0 }

// ── 공통 아코디언 섹션 ──
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
          <span style={{ fontSize: 18 }}>{icon}</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{title}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{summary}</span>
          <span style={{ fontSize: 14, color: '#9ca3af', transition: 'transform 0.2s', transform: open ? 'rotate(180deg)' : 'none' }}>▼</span>
        </div>
      </button>
      {open && <div style={{ padding: '0 16px 16px' }}>{children}</div>}
    </div>
  )
}

// ── 인라인 폼 ──
function InlineForm({ fields, onSave, onCancel, saving }: {
  fields: { label: string; key: string; type?: string; options?: string[]; placeholder?: string }[]
  onSave: (vals: Record<string, string>) => void
  onCancel: () => void
  saving?: boolean
}) {
  const [vals, setVals] = useState<Record<string, string>>(Object.fromEntries(fields.map(f => [f.key, ''])))
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 10,
    border: '1.5px solid #e5e7eb', background: '#fafafa',
    fontSize: 13, color: '#374151', outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  }
  return (
    <div style={{ background: '#f9fafb', borderRadius: 14, padding: 14, marginBottom: 10 }}>
      {fields.map(f => (
        <div key={f.key} style={{ marginBottom: 10 }}>
          <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>{f.label}</label>
          {f.options ? (
            <select value={vals[f.key]} onChange={e => setVals(v => ({ ...v, [f.key]: e.target.value }))} style={inputStyle}>
              <option value="">선택</option>
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          ) : (
            <input
              type={f.type === 'number' ? 'text' : f.type ?? 'text'}
              inputMode={f.type === 'number' ? 'numeric' : undefined}
              placeholder={f.placeholder ?? ''}
              value={vals[f.key]}
              onChange={e => setVals(v => ({
                ...v, [f.key]: f.type === 'number' ? fmt(e.target.value) : e.target.value
              }))}
              style={inputStyle}
            />
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(vals)} disabled={saving} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
          background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
        }}>저장</button>
        <button onClick={onCancel} style={{
          flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb',
          background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
        }}>취소</button>
      </div>
    </div>
  )
}

export default function AssetsClient({ profile, userId, accounts, cards, fixedCosts, budgets, thisMonthSpent, categorySpent, thisMonth }: Props) {
  const supabase = createClient()
  const router = useRouter()

  // 로컬 상태
  const [localAccounts, setLocalAccounts] = useState(accounts)
  const [localCards, setLocalCards] = useState(cards)
  const [localFixed, setLocalFixed] = useState(fixedCosts)
  const [localBudgets, setLocalBudgets] = useState(budgets)

  // 폼 표시 상태
  const [showAddAccount, setShowAddAccount] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [showAddFixed, setShowAddFixed] = useState<'expense' | 'saving' | null>(null)
  const [editingIncome, setEditingIncome] = useState(false)

  const [income, setIncome] = useState(profile?.income ? Number(profile.income).toLocaleString() : '')
  const [savingGoal, setSavingGoal] = useState(profile?.saving_goal ? Number(profile.saving_goal).toLocaleString() : '')

  // 계산값
  const monthlyIncome = profile?.income ?? 0
  const fixedExpenses = localFixed.filter(f => !f.kind || f.kind === '고정지출')
  const fixedSavings = localFixed.filter(f => f.kind === '고정저축')
  const fixedExpenseTotal = fixedExpenses.reduce((s, f) => s + f.amount, 0)
  const fixedSavingTotal = fixedSavings.reduce((s, f) => s + f.amount, 0)
  const totalBalance = localAccounts.reduce((s, a) => s + (a.balance ?? 0), 0)
  const totalBudget = localBudgets.reduce((s, b) => s + b.amount, 0)
  const cardMonthlyUsage = thisMonthSpent // 간단히 이번달 총 지출로 대체

  // ── 월 수입 저장 ──
  async function saveIncome() {
    await supabase.from('users').update({ income: parse(income), saving_goal: parse(savingGoal) }).eq('id', userId)
    setEditingIncome(false)
    router.refresh()
  }

  // ── 계좌 추가 ──
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

  // ── 카드 추가 ──
  async function addCard(vals: Record<string, string>) {
    const { data } = await supabase.from('cards').insert({
      user_id: userId, name: vals.name, bank: vals.bank,
      due_day: parseInt(vals.due_day) || null,
      linked_account_id: vals.linked_account_id || null,
    }).select().single()
    if (data) setLocalCards(c => [...c, data])
    setShowAddCard(false)
  }

  async function deleteCard(id: string) {
    await supabase.from('cards').delete().eq('id', id)
    setLocalCards(c => c.filter(x => x.id !== id))
  }

  // ── 고정비 추가 ──
  async function addFixed(vals: Record<string, string>, kind: '고정지출' | '고정저축') {
    const { data } = await supabase.from('fixed_costs').insert({
      user_id: userId, name: vals.name, amount: parse(vals.amount),
      kind, due_day: parseInt(vals.due_day) || null,
      linked_account_id: vals.linked_account_id || null,
      type: kind === '고정지출' ? '월정액' : '월정액',
    }).select().single()
    if (data) setLocalFixed(f => [...f, data])
    setShowAddFixed(null)
  }

  async function deleteFixed(id: string) {
    await supabase.from('fixed_costs').delete().eq('id', id)
    setLocalFixed(f => f.filter(x => x.id !== id))
  }

  // ── 예산 저장 ──
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

  const cardStyle: React.CSSProperties = { fontSize: 12, color: '#6b7280' }
  const rowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #f9fafb',
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <h1 className="text-lg font-semibold mb-4" style={{ color: 'var(--color-accent)' }}>자산</h1>

      {/* ── 1. 월 수입 ── */}
      <Section
        icon="💰" title="월 수입"
        summary={monthlyIncome > 0 ? `₩${monthlyIncome.toLocaleString()}` : '미설정'}
        defaultOpen={!monthlyIncome}
      >
        {!editingIncome ? (
          <div>
            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-accent)', marginBottom: 8 }}>
              ₩{monthlyIncome.toLocaleString()}
            </p>
            {profile?.saving_goal > 0 && (
              <p style={cardStyle}>저축 목표 ₩{Number(profile.saving_goal).toLocaleString()}</p>
            )}
            <button onClick={() => setEditingIncome(true)} style={{
              marginTop: 10, fontSize: 12, color: 'var(--color-primary)',
              background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            }}>✏️ 수정</button>
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
              <button onClick={saveIncome} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: 'none',
                background: 'var(--color-primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              }}>저장</button>
              <button onClick={() => setEditingIncome(false)} style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1.5px solid #e5e7eb',
                background: '#fff', color: '#6b7280', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
              }}>취소</button>
            </div>
          </div>
        )}
      </Section>

      {/* ── 2. 예산 ── */}
      <Section icon="🎯" title="예산" summary={totalBudget > 0 ? `총 ₩${totalBudget.toLocaleString()} 설정` : '미설정'}>
        <div>
          {(CATEGORIES as readonly string[]).map(cat => {
            const b = localBudgets.find(x => x.category === cat)
            const spent = categorySpent[cat] ?? 0
            const budgetAmt = b?.amount ?? 0
            const pct = budgetAmt > 0 ? Math.min(Math.round((spent / budgetAmt) * 100), 100) : 0
            const over = budgetAmt > 0 && spent > budgetAmt
            return (
              <BudgetRow key={cat} category={cat} budgetAmt={budgetAmt} spent={spent} pct={pct} over={over}
                onSave={amt => saveBudget(cat, amt)} />
            )
          })}
          {totalBudget > 0 && (
            <div style={{ ...rowStyle, borderBottom: 'none', marginTop: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>총 예산</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-accent)' }}>₩{totalBudget.toLocaleString()}</span>
            </div>
          )}
        </div>
      </Section>

      {/* ── 3. 고정비 ── */}
      <Section icon="📌" title="고정비" summary={`월 ₩${fixedExpenseTotal.toLocaleString()} 지출`}>
        {/* 고정 지출 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>고정 지출</span>
            <button onClick={() => setShowAddFixed(showAddFixed === 'expense' ? null : 'expense')} style={{
              fontSize: 11, color: 'var(--color-primary)', background: 'var(--color-primary-light)',
              border: 'none', padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>+ 추가</button>
          </div>
          {showAddFixed === 'expense' && (
            <InlineForm
              fields={[
                { label: '이름', key: 'name', placeholder: '예) 넷플릭스' },
                { label: '금액', key: 'amount', type: 'number', placeholder: '0' },
                { label: '매월 빠져나가는 날', key: 'due_day', placeholder: '예) 25' },
                { label: '연결 계좌', key: 'linked_account_id', options: ['', ...localAccounts.map(a => a.id)] },
              ]}
              onSave={v => addFixed(v, '고정지출')}
              onCancel={() => setShowAddFixed(null)}
            />
          )}
          {fixedExpenses.length === 0 && <p style={{ fontSize: 12, color: '#9ca3af' }}>고정 지출이 없어요</p>}
          {fixedExpenses.map(f => (
            <FixedRow key={f.id} item={f}
              accountName={localAccounts.find(a => a.id === f.linked_account_id)?.name}
              onDelete={() => deleteFixed(f.id)} />
          ))}
          <p style={{ fontSize: 12, color: '#6b7280', marginTop: 6, fontWeight: 600 }}>
            소계 ₩{fixedExpenseTotal.toLocaleString()}
          </p>
        </div>

        {/* 고정 저축 */}
        <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#374151' }}>고정 저축</span>
            <button onClick={() => setShowAddFixed(showAddFixed === 'saving' ? null : 'saving')} style={{
              fontSize: 11, color: '#059669', background: '#f0fdf4',
              border: 'none', padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600,
            }}>+ 추가</button>
          </div>
          {showAddFixed === 'saving' && (
            <InlineForm
              fields={[
                { label: '이름', key: 'name', placeholder: '예) 신한 적금' },
                { label: '금액', key: 'amount', type: 'number', placeholder: '0' },
                { label: '매월 빠져나가는 날', key: 'due_day', placeholder: '예) 5' },
                { label: '연결 계좌', key: 'linked_account_id', options: ['', ...localAccounts.map(a => a.id)] },
    
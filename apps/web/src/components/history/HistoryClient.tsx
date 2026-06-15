'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import dayjs from 'dayjs'
import 'dayjs/locale/ko'
import { CATEGORIES } from '@/lib/themes'

dayjs.locale('ko')

interface Expense {
  id: string
  name: string
  amount: number
  category: string
  date: string
  payment_method: string | null
  memo: string | null
  type: 'expense' | 'income' | 'transfer'
}

interface Props {
  userId: string
  initialExpenses: Expense[]
  paymentMethods: string[]
  userCategories?: string[]
}

type ViewMode = 'list' | 'calendar'
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
type TypeFilter = '' | 'expense' | 'income' | 'transfer'

export default function HistoryClient({ userId, initialExpenses, paymentMethods, userCategories }: Props) {
  const supabase = createClient()

  const [expenses, setExpenses] = useState(initialExpenses)
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterPay, setFilterPay] = useState('')
  const [filterType, setFilterType] = useState<TypeFilter>('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(dayjs().format('YYYY-MM'))
  const [editingId, setEditingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && e.category !== filterCat) return false
      if (filterPay && e.payment_method !== filterPay) return false
      if (filterType && (e.type ?? 'expense') !== filterType) return false
      return true
    })
    switch (sort) {
      case 'date_asc': return [...list].sort((a, b) => a.date.localeCompare(b.date))
      case 'amount_desc': return [...list].sort((a, b) => b.amount - a.amount)
      case 'amount_asc': return [...list].sort((a, b) => a.amount - b.amount)
      default: return [...list].sort((a, b) => b.date.localeCompare(a.date))
    }
  }, [expenses, search, filterCat, filterPay, filterType, sort])

  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>()
    filtered.forEach(e => {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    })
    return [...map.entries()].sort((a, b) =>
      sort === 'date_asc' ? a[0].localeCompare(b[0]) : b[0].localeCompare(a[0])
    )
  }, [filtered, sort])

  const { calExpenseMap, calIncomeSet } = useMemo(() => {
    const calExpenseMap = new Map<string, number>()
    const calIncomeSet = new Set<string>()
    expenses
      .filter(e => e.date.startsWith(calMonth))
      .forEach(e => {
        const type = e.type ?? 'expense'
        if (type === 'income') {
          calIncomeSet.add(e.date)
        } else {
          calExpenseMap.set(e.date, (calExpenseMap.get(e.date) ?? 0) + e.amount)
        }
      })
    return { calExpenseMap, calIncomeSet }
  }, [expenses, calMonth])

  async function deleteExpense(id: string) {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(es => es.filter(e => e.id !== id))
    setEditingId(null)
  }

  async function saveExpense(id: string, updates: Partial<Expense>) {
    await supabase.from('expenses').update(updates).eq('id', id)
    setExpenses(es => es.map(e => e.id === id ? { ...e, ...updates } : e))
    setEditingId(null)
  }

  const today = dayjs().format('YYYY-MM-DD')
  const hasFilter = !!(search || filterCat || filterPay || filterType)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>내역</h1>
        <div className="flex items-center gap-2">
          <a href="/add"
            className="w-8 h-8 flex items-center justify-center rounded-full text-white text-lg font-bold"
            style={{ background: 'var(--color-primary)' }}>+</a>
          <button onClick={() => setView(v => v === 'list' ? 'calendar' : 'list')}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-base">
            {view === 'list' ? '🗓' : '≡'}
          </button>
        </div>
      </div>

      <div className="relative mb-3">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input
          className="w-full pl-9 pr-4 py-2.5 bg-white rounded-xl border border-gray-100 text-sm outline-none text-gray-700 placeholder:text-gray-300"
          placeholder="항목명 검색"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">✕</button>
        )}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        <select value={filterType} onChange={e => setFilterType(e.target.value as TypeFilter)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer outline-none"
          style={{ background: filterType ? 'var(--color-primary)' : 'white', color: filterType ? 'white' : '#6b7280', borderColor: filterType ? 'var(--color-primary)' : '#e5e7eb' }}>
          <option value="">전체</option>
          <option value="expense">지출</option>
          <option value="income">수입</option>
        </select>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer outline-none"
          style={{ background: filterCat ? 'var(--color-primary)' : 'white', color: filterCat ? 'white' : '#6b7280', borderColor: filterCat ? 'var(--color-primary)' : '#e5e7eb' }}>
          <option value="">카테고리 전체</option>
          {(userCategories && userCategories.length > 0 ? userCategories : (CATEGORIES as readonly string[])).map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterPay} onChange={e => setFilterPay(e.target.value)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer outline-none"
          style={{ background: filterPay ? 'var(--color-primary)' : 'white', color: filterPay ? 'white' : '#6b7280', borderColor: filterPay ? 'var(--color-primary)' : '#e5e7eb' }}>
          <option value="">결제수단 전체</option>
          {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-500 cursor-pointer outline-none">
          <option value="date_desc">최신순</option>
          <option value="date_asc">오래된순</option>
          <option value="amount_desc">금액 높은순</option>
          <option value="amount_asc">금액 낮은순</option>
        </select>
        {hasFilter && (
          <button onClick={() => { setSearch(''); setFilterCat(''); setFilterPay(''); setFilterType('') }}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-rose-50 text-rose-400 border border-rose-100">
            초기화 ✕
          </button>
        )}
      </div>

      {view === 'list' && (
        <div>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">{hasFilter ? '해당 조건의 내역이 없어요' : '아직 기록된 내역이 없어요 🌿'}</p>
              {!hasFilter && (
                <a href="/add" className="mt-3 inline-block text-sm font-medium" style={{ color: 'var(--color-primary)' }}>첫 기록 남기기 →</a>
              )}
            </div>
          )}
          {grouped.map(([date, items]) => {
            const expenseSum = items.filter(e => (e.type ?? 'expense') === 'expense').reduce((s, e) => s + e.amount, 0)
            const incomeSum = items.filter(e => (e.type ?? 'expense') === 'income').reduce((s, e) => s + e.amount, 0)
            return (
              <div key={date} className="mb-4">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-semibold text-gray-500">
                    {dayjs(date).format('M월 D일 (ddd)')}
                    {date === today && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--color-primary)' }}>오늘</span>}
                  </span>
                  <div className="flex gap-2 text-xs font-bold">
                    {(() => {
                      const net = expenseSum - incomeSum
                      if (net > 0) return <span className="text-rose-400">-{net.toLocaleString()}원</span>
                      if (net < 0) return <span className="text-emerald-500">+{Math.abs(net).toLocaleString()}원</span>
                      return null
                    })()}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {items.map((e, idx) => (
                    <div key={e.id}>
                      {editingId === e.id
                        ? <EditRow expense={e} onSave={u => saveExpense(e.id, u)} onDelete={() => deleteExpense(e.id)} onCancel={() => setEditingId(null)} />
                        : <ExpenseRow expense={e} onTap={() => setEditingId(e.id)} />
                      }
                      {idx < items.length - 1 && <div className="h-px bg-gray-50 mx-4" />}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {view === 'calendar' && (
        <CalendarView
          calMonth={calMonth} onChangeMonth={setCalMonth} calExpenseMap={calExpenseMap} calIncomeSet={calIncomeSet} today={today}
          selectedDate={selectedDate} onSelectDate={d => setSelectedDate(selectedDate === d ? null : d)}
          expenses={expenses} editingId={editingId} onEdit={setEditingId}
          onSave={saveExpense} onDelete={deleteExpense} onCancelEdit={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

function ExpenseRow({ expense, onTap }: { expense: Expense; onTap: () => void }) {
  const type = expense.type ?? 'expense'
  const isIncome = type === 'income'
  const isTransfer = type === 'transfer'
  return (
    <button onClick={onTap} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-800">{expense.name}</p>
          {isIncome && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">수입</span>}
          {isTransfer && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-500 font-semibold">이체</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{expense.category}{expense.payment_method && ` · ${expense.payment_method}`}</p>
      </div>
      <span className={`text-sm font-bold ${isIncome ? 'text-emerald-500' : isTransfer ? 'text-blue-500' : 'text-rose-400'}`}>
        {isIncome ? '+' : isTransfer ? '↔' : '-'}{expense.amount.toLocaleString()}원
      </span>
    </button>
  )
}

const PAYMENT_OPTIONS = ['카드', '현금', '카카오페이', '네이버페이', '토스', '계좌이체']

function EditRow({ expense, onSave, onDelete, onCancel, userCategories }: {
  expense: Expense
  onSave: (updates: Partial<Expense>) => void
  onDelete: () => void
  onCancel: () => void
  userCategories?: string[]
}) {
  const [form, setForm] = useState({ ...expense, type: expense.type ?? 'expense', amount: expense.amount.toLocaleString(), payment_method: expense.payment_method ?? '' })
  function u(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-gray-500">{dayjs(expense.date).format('M월 D일')}</span>
        <button onClick={onCancel} className="text-xs text-gray-400">✕</button>
      </div>
      <div className="space-y-2">
        <div className="flex bg-white rounded-xl border border-gray-200 p-0.5">
          {(['expense', 'income'] as const).map(t => (
            <button key={t} onClick={() => u('type', t)}
              className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: form.type === t ? 'var(--color-primary)' : 'transparent', color: form.type === t ? 'white' : '#9ca3af' }}>
              {t === 'expense' ? '💸 지출' : '💰 수입'}
            </button>
          ))}
        </div>
        <input value={form.name} onChange={e => u('name', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" placeholder="항목명" />
        <input type="text" inputMode="numeric" value={form.amount}
          onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); u('amount', n ? Number(n).toLocaleString() : '') }}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" placeholder="금액" />
        {form.type !== 'income' && (
          <div className="flex flex-wrap gap-1.5">
            {(userCategories && userCategories.length > 0 ? userCategories : (CATEGORIES as readonly string[])).map(cat => (
              <button key={cat} onClick={() => u('category', cat)}
                className="text-xs px-2.5 py-1 rounded-full border transition-all"
                style={{ background: form.category === cat ? 'var(--color-primary)' : 'white', color: form.category === cat ? 'white' : '#9ca3af', borderColor: form.category === cat ? 'var(--color-primary)' : '#e5e7eb' }}>
                {cat}
              </button>
            ))}
          </div>
        )}
        <input type="date" value={form.date} onChange={e => u('date', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
        <div>
          <p className="text-[11px] text-gray-400 mb-1">결제수단</p>
          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => u('payment_method', '')}
              className="text-xs px-2.5 py-1 rounded-full border transition-all"
              style={{ background: !form.payment_method ? 'var(--color-primary)' : 'white', color: !form.payment_method ? 'white' : '#9ca3af', borderColor: !form.payment_method ? 'var(--color-primary)' : '#e5e7eb' }}>없음</button>
            {PAYMENT_OPTIONS.map(pm => (
              <button key={pm} onClick={() => u('payment_method', pm)}
                className="text-xs px-2.5 py-1 rounded-full border transition-all"
                style={{ background: form.payment_method === pm ? 'var(--color-primary)' : 'white', color: form.payment_method === pm ? 'white' : '#9ca3af', borderColor: form.payment_method === pm ? 'var(--color-primary)' : '#e5e7eb' }}>
                {pm}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSave({
          name: form.name,
          amount: parseInt(form.amount.replace(/,/g, '')) || expense.amount,
          category: form.category as any,
          date: form.date,
          payment_method: form.payment_method || null,
          type: form.type as 'expense' | 'income',
        })} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: 'var(--color-primary)' }}>저장</button>
        <button onClick={onDelete} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-400 border border-rose-100">삭제</button>
      </div>
    </div>
  )
}

function CalendarView({ calMonth, onChangeMonth, calExpenseMap, calIncomeSet, today, selectedDate, onSelectDate, expenses, editingId, onEdit, onSave, onDelete, onCancelEdit }: {
  calMonth: string; onChangeMonth: (m: string) => void; calExpenseMap: Map<string, number>; calIncomeSet: Set<string>
  today: string; selectedDate: string | null; onSelectDate: (d: string) => void
  expenses: Expense[]; editingId: string | null; onEdit: (id: string) => void
  onSave: (id: string, u: Partial<Expense>) => void; onDelete: (id: string) => void; onCancelEdit: () => void
}) {
  const startOfMonth = dayjs(calMonth).startOf('month')
  const daysInMonth = startOfMonth.daysInMonth()
  const firstDow = startOfMonth.day()
  const weeks: (string | null)[][] = []
  let week: (string | null)[] = Array(firstDow).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calMonth}-${String(d).padStart(2, '0')}`
    week.push(dateStr)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) weeks.push([...week, ...Array(7 - week.length).fill(null)])
  const selectedItems = selectedDate ? expenses.filter(e => e.date === selectedDate) : []

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onChangeMonth(dayjs(calMonth).subtract(1, 'month').format('YYYY-MM'))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600">‹</button>
        <span className="text-sm font-bold text-gray-800">{dayjs(calMonth).format('YYYY년 M월')}</span>
        <button onClick={() => onChangeMonth(dayjs(calMonth).add(1, 'month').format('YYYY-MM'))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1"
            style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : undefined }}>{d}</div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => {
              if (!date) return <div key={di} className="h-14" />
              const amt = calExpenseMap.get(date)
              const hasIncome = calIncomeSet.has(date)
              const isToday = date === today
              const isSelected = date === selectedDate
              const dow = new Date(date).getDay()
              return (
                <button key={date} onClick={() => onSelectDate(date)}
                  className="h-14 flex flex-col items-center justify-center gap-0.5 transition-colors"
                  style={{ background: isSelected ? 'var(--color-primary-light)' : undefined }}>
                  <span className="text-xs font-medium flex items-center justify-center"
                    style={{ color: isToday ? 'white' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : '#374151', background: isToday ? 'var(--color-primary)' : undefined, width: 22, height: 22, borderRadius: '50%' }}>
                    {parseInt(date.split('-')[2])}
                  </span>
                  {amt ? <span className="text-[9px] font-bold text-rose-400">-{amt >= 1000000 ? `${(amt/1000000).toFixed(1)}M` : amt >= 10000 ? `${Math.round(amt/1000)}k` : amt.toLocaleString()}</span> : null}
                  {hasIncome && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#10B981', display: 'inline-block' }} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      {selectedDate && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-50">
            <span className="text-sm font-bold text-gray-700">{dayjs(selectedDate).format('M월 D일 (ddd)')}</span>
            <span className="text-sm font-bold text-rose-400">
              {selectedItems.filter(e => (e.type ?? 'expense') !== 'income').length > 0
                ? `-${selectedItems.filter(e => (e.type ?? 'expense') !== 'income').reduce((s, e) => s + e.amount, 0).toLocaleString()}원`
                : ''}
            </span>
          </div>
          {selectedItems.length === 0
            ? <p className="text-center text-sm text-gray-400 py-8">이날은 내역이 없었어요 🌿</p>
            : selectedItems.map((e, idx) => (
              <div key={e.id}>
                {editingId === e.id
                  ? <EditRow expense={e} onSave={u => onSave(e.id, u)} onDelete={() => onDelete(e.id)} onCancel={onCancelEdit} />
                  : <ExpenseRow expense={e} onTap={() => onEdit(e.id)} />
                }
                {idx < selectedItems.length - 1 && <div className="h-px bg-gray-50 mx-4" />}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

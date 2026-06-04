'use client'
import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
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
}

interface Props {
  userId: string
  initialExpenses: Expense[]
  paymentMethods: string[]
}

type ViewMode = 'list' | 'calendar'
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'

export default function HistoryClient({ userId, initialExpenses, paymentMethods }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [expenses, setExpenses] = useState(initialExpenses)
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterPay, setFilterPay] = useState('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(dayjs().format('YYYY-MM'))
  const [editingId, setEditingId] = useState<string | null>(null)

  // 필터 + 정렬 적용
  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && e.category !== filterCat) return false
      if (filterPay && e.payment_method !== filterPay) return false
      return true
    })
    switch (sort) {
      case 'date_asc': return [...list].sort((a, b) => a.date.localeCompare(b.date))
      case 'amount_desc': return [...list].sort((a, b) => b.amount - a.amount)
      case 'amount_asc': return [...list].sort((a, b) => a.amount - b.amount)
      default: return [...list].sort((a, b) => b.date.localeCompare(a.date))
    }
  }, [expenses, search, filterCat, filterPay, sort])

  // 날짜별 그룹핑
  const grouped = useMemo(() => {
    const map = new Map<string, Expense[]>()
    filtered.forEach(e => {
      const list = map.get(e.date) ?? []
      list.push(e)
      map.set(e.date, list)
    })
    return [...map.entries()].sort((a, b) => {
      if (sort === 'date_asc') return a[0].localeCompare(b[0])
      return b[0].localeCompare(a[0])
    })
  }, [filtered, sort])

  // 캘린더용 날짜별 합계
  const calMap = useMemo(() => {
    const map = new Map<string, number>()
    expenses.filter(e => e.date.startsWith(calMonth)).forEach(e => {
      map.set(e.date, (map.get(e.date) ?? 0) + e.amount)
    })
    return map
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
  const hasFilter = !!(search || filterCat || filterPay)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      {/* 헤더 */}
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

      {/* 검색창 */}
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

      {/* 필터 칩 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-3 no-scrollbar">
        {/* 카테고리 */}
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer outline-none"
          style={{
            background: filterCat ? 'var(--color-primary)' : 'white',
            color: filterCat ? 'white' : '#6b7280',
            borderColor: filterCat ? 'var(--color-primary)' : '#e5e7eb',
          }}>
          <option value="">카테고리 전체</option>
          {(CATEGORIES as readonly string[]).map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* 결제수단 */}
        <select value={filterPay} onChange={e => setFilterPay(e.target.value)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full border cursor-pointer outline-none"
          style={{
            background: filterPay ? 'var(--color-primary)' : 'white',
            color: filterPay ? 'white' : '#6b7280',
            borderColor: filterPay ? 'var(--color-primary)' : '#e5e7eb',
          }}>
          <option value="">결제수단 전체</option>
          {paymentMethods.map(p => <option key={p} value={p}>{p}</option>)}
        </select>

        {/* 정렬 */}
        <select value={sort} onChange={e => setSort(e.target.value as SortKey)}
          className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-500 cursor-pointer outline-none">
          <option value="date_desc">최신순</option>
          <option value="date_asc">오래된순</option>
          <option value="amount_desc">금액 높은순</option>
          <option value="amount_asc">금액 낮은순</option>
        </select>

        {hasFilter && (
          <button onClick={() => { setSearch(''); setFilterCat(''); setFilterPay('') }}
            className="flex-shrink-0 text-xs px-3 py-1.5 rounded-full bg-rose-50 text-rose-400 border border-rose-100">
            초기화 ✕
          </button>
        )}
      </div>

      {/* ── 리스트 뷰 ── */}
      {view === 'list' && (
        <div>
          {filtered.length === 0 && (
            <div className="text-center py-16">
              <p className="text-gray-400 text-sm">
                {hasFilter ? '해당 조건의 내역이 없어요' : '아직 기록된 지출이 없어요 🌿'}
              </p>
              {!hasFilter && (
                <a href="/add" className="mt-3 inline-block text-sm font-medium"
                  style={{ color: 'var(--color-primary)' }}>첫 기록 남기기 →</a>
              )}
            </div>
          )}
          {grouped.map(([date, items]) => (
            <div key={date} className="mb-4">
              <div className="flex justify-between items-center mb-2 px-1">
                <span className="text-xs font-semibold text-gray-500">
                  {dayjs(date).format('M월 D일 (ddd)')}
                  {date === today && <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full text-white" style={{ background: 'var(--color-primary)' }}>오늘</span>}
                </span>
                <span className="text-xs font-bold text-rose-400">
                  -{items.reduce((s, e) => s + e.amount, 0).toLocaleString()}원
                </span>
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
          ))}
        </div>
      )}

      {/* ── 캘린더 뷰 ── */}
      {view === 'calendar' && (
        <CalendarView
          calMonth={calMonth}
          onChangeMonth={setCalMonth}
          calMap={calMap}
          today={today}
          selectedDate={selectedDate}
          onSelectDate={d => setSelectedDate(selectedDate === d ? null : d)}
          expenses={expenses}
          editingId={editingId}
          onEdit={setEditingId}
          onSave={saveExpense}
          onDelete={deleteExpense}
          onCancelEdit={() => setEditingId(null)}
        />
      )}
    </div>
  )
}

// ── 내역 행 ──
function ExpenseRow({ expense, onTap }: { expense: Expense; onTap: () => void }) {
  return (
    <button onClick={onTap} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors">
      <div>
        <p className="text-sm font-semibold text-gray-800">{expense.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">
          {expense.category}{expense.payment_method && ` · ${expense.payment_method}`}
        </p>
      </div>
      <span className="text-sm font-bold text-rose-400">-₩{expense.amount.toLocaleString()}</span>
    </button>
  )
}

// ── 수정 행 ──
function EditRow({ expense, onSave, onDelete, onCancel }: {
  expense: Expense
  onSave: (updates: Partial<Expense>) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ ...expense, amount: expense.amount.toLocaleString() })
  function u(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  return (
    <div className="p-4 bg-gray-50">
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-semibold text-gray-500">{dayjs(expense.date).format('M월 D일')}</span>
        <button onClick={onCancel} className="text-xs text-gray-400">✕</button>
      </div>
      <div className="space-y-2">
        <input value={form.name} onChange={e => u('name', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" placeholder="항목명" />
        <input type="text" inputMode="numeric" value={form.amount}
          onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); u('amount', n ? Number(n).toLocaleString() : '') }}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" placeholder="금액" />
        <div className="flex flex-wrap gap-1.5">
          {(CATEGORIES as readonly string[]).map(cat => (
            <button key={cat} onClick={() => u('category', cat)}
              className="text-xs px-2.5 py-1 rounded-full border transition-all"
              style={{
                background: form.category === cat ? 'var(--color-primary)' : 'white',
                color: form.category === cat ? 'white' : '#9ca3af',
                borderColor: form.category === cat ? 'var(--color-primary)' : '#e5e7eb',
              }}>{cat}</button>
          ))}
        </div>
        <input type="date" value={form.date} onChange={e => u('date', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={() => onSave({
          name: form.name, amount: parseInt(form.amount.replace(/,/g, '')) || expense.amount,
          category: form.category, date: form.date,
        })}
          className="flex-1 py-2 rounded-xl text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}>저장</button>
        <button onClick={onDelete}
          className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-400 border border-rose-100">삭제</button>
      </div>
    </div>
  )
}

// ── 캘린더 뷰 ──
function CalendarView({ calMonth, onChangeMonth, calMap, today, selectedDate, onSelectDate, expenses, editingId, onEdit, onSave, onDelete, onCancelEdit }: {
  calMonth: string
  onChangeMonth: (m: string) => void
  calMap: Map<string, number>
  today: string
  selectedDate: string | null
  onSelectDate: (d: string) => void
  expenses: Expense[]
  editingId: string | null
  onEdit: (id: string) => void
  onSave: (id: string, u: Partial<Expense>) => void
  onDelete: (id: string) => void
  onCancelEdit: () => void
}) {
  const startOfMonth = dayjs(calMonth).startOf('month')
  const daysInMonth = startOfMonth.daysInMonth()
  const firstDow = startOfMonth.day() // 0=일

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
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => onChangeMonth(dayjs(calMonth).subtract(1, 'month').format('YYYY-MM'))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600">‹</button>
        <span className="text-sm font-bold text-gray-800">{dayjs(calMonth).format('YYYY년 M월')}</span>
        <button onClick={() => onChangeMonth(dayjs(calMonth).add(1, 'month').format('YYYY-MM'))}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white border border-gray-200 text-gray-600">›</button>
      </div>

      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 mb-1">
        {['일','월','화','수','목','금','토'].map((d, i) => (
          <div key={d} className="text-center text-xs text-gray-400 py-1"
            style={{ color: i === 0 ? '#ef4444' : i === 6 ? '#3b82f6' : undefined }}>{d}</div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((date, di) => {
              if (!date) return <div key={di} className="h-14" />
              const amt = calMap.get(date)
              const isToday = date === today
              const isSelected = date === selectedDate
              const dow = new Date(date).getDay()
              return (
                <button key={date} onClick={() => onSelectDate(date)}
                  className="h-14 flex flex-col items-center justify-center gap-0.5 transition-colors"
                  style={{ background: isSelected ? 'var(--color-primary-light)' : undefined }}>
                  <span className="text-xs font-medium flex items-center justify-center"
                    style={{
                      color: isToday ? 'white' : dow === 0 ? '#ef4444' : dow === 6 ? '#3b82f6' : '#374151',
                      background: isToday ? 'var(--color-primary)' : undefined,
                      width: 22, height: 22, borderRadius: '50%',
                    }}>{parseInt(date.split('-')[2])}</span>
                  {amt ? (
                    <span className="text-[9px] font-bold text-rose-400">
                      -{amt >= 10000 ? `${Math.round(amt / 1000)}k` : amt.toLocaleString()}
                    </span>
                  ) : null}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* 선택 날짜 슬라이드업 */}
      {selectedDate && (
        <div className="mt-4 bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b border-gray-50">
            <span className="text-sm font-bold text-gray-700">
              {dayjs(selectedDate).format('M월 D일 (ddd)')}
            </span>
            <span className="text-sm font-bold text-rose-400">
              {selectedItems.length > 0 ? `-₩${selectedItems.reduce((s, e) => s + e.amount, 0).toLocaleString()}` : ''}
            </span>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-center text-sm text-gray-400 py-8">이날은 지출이 없었어요 🌿</p>
          ) : (
            selectedItems.map((e, idx) => (
              <div key={e.id}>
                {editingId === e.id
                  ? <EditRow expense={e} onSave={u => onSave(e.id, u)} onDelete={() => onDelete(e.id)} onCancel={onCancelEdit} />
                  : <ExpenseRow expense={e} onTap={() => onEdit(e.id)} />
                }
                {idx < selectedItems.length - 1 && <div className="h-px bg-gray-50 mx-4" />}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

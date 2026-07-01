'use client'
import { useState, useMemo, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
  type: 'expense' | 'income' | 'transfer' | 'savings'
}

interface Props {
  userId: string
  initialExpenses: Expense[]
  paymentMethods: string[]
  userCategories?: string[]
  initialCategory?: string
}

type ViewMode = 'list' | 'calendar'
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc'
type TypeFilter = '' | 'expense' | 'income' | 'transfer' | 'savings'

export default function HistoryClient({ userId, initialExpenses, paymentMethods, userCategories, initialCategory }: Props) {
  const supabase = createClient()

  const [expenses, setExpenses] = useState(initialExpenses)

  // DataLoader가 새 데이터 fetch 후 prop 갱신 시 동기화 (display:none/block 마운트 유지 구조 대응)
  useEffect(() => {
    setExpenses(initialExpenses)
  }, [initialExpenses])
  const [accounts, setAccounts] = useState<{id:string;name:string;balance:number}[]>([])
  const [cards, setCards] = useState<{name:string}[]>([])

  useEffect(() => {
    supabase.from('accounts').select('id, name, balance').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setAccounts(data) })
    supabase.from('cards').select('name').eq('user_id', userId).order('name')
      .then(({ data }) => { if (data) setCards(data) })
  }, [userId])
  const [view, setView] = useState<ViewMode>('list')
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState(initialCategory ?? '')
  useEffect(() => { setFilterCat(initialCategory ?? '') }, [initialCategory])
  const [filterPay, setFilterPay] = useState('')
  const [filterType, setFilterType] = useState<TypeFilter>('')
  const [sort, setSort] = useState<SortKey>('date_desc')
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(dayjs().format('YYYY-MM'))
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const pathname = usePathname()
  // 다른 탭으로 이동 시 수정 모달 닫기
  useEffect(() => {
    if (pathname !== '/history') setEditingExpense(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])
  const [confirmModal, setConfirmModal] = useState<{ title: string; lines: string[]; onConfirm: () => void } | null>(null)
  const [alertMsg, setAlertMsg] = useState('')

  const filtered = useMemo(() => {
    let list = expenses.filter(e => {
      if (search && !e.name.toLowerCase().includes(search.toLowerCase())) return false
      if (filterCat && e.category !== filterCat) return false
      if (filterPay && e.payment_method !== filterPay) return false
      if (filterType) {
        const t = e.type ?? 'expense'
        if (filterType === 'transfer') {
          if (t !== 'transfer' && t !== 'savings') return false
        } else {
          if (t !== filterType) return false
        }
      }
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

  async function handleCardPayment(expense: Expense) {
    const payMethod = expense.payment_method ?? ''
    const thisMonth = dayjs().format('YYYY-MM')

    const monthTotal = expenses
      .filter(e => (e.type ?? 'expense') === 'expense' && e.payment_method === payMethod && e.date.startsWith(thisMonth))
      .reduce((sum, e) => sum + e.amount, 0)

    const alreadyPaid = expenses
      .filter(e => (e.name?.includes('카드 대금') && (e.payment_method === payMethod || e.name?.includes(payMethod)) && e.date.startsWith(thisMonth)))
      .reduce((sum, e) => sum + e.amount, 0)

    const remaining = monthTotal - alreadyPaid
    if (remaining <= 0) { setAlertMsg(`${payMethod} 이번 달 납부할 잔액이 없어요.`); setTimeout(() => setAlertMsg(''), 3000); return }

    const { data: cards } = await supabase.from('cards').select('*').eq('user_id', userId)
    const matchedCard = (cards ?? []).find((card: any) =>
      payMethod.includes(card.name) || card.name.includes(payMethod) || card.name === payMethod
    )
    let accountName = ''
    if (matchedCard?.linked_account_id) {
      const { data: acc } = await supabase.from('accounts').select('name').eq('id', matchedCard.linked_account_id).single()
      accountName = acc?.name ?? ''
    }

    const infoLines = [
      `이번 달 [${payMethod}] 총 지출: ${monthTotal.toLocaleString()}원`,
      alreadyPaid > 0 ? `이미 납부: -${alreadyPaid.toLocaleString()}원` : null,
      alreadyPaid > 0 ? `납부 잔액: ${remaining.toLocaleString()}원` : null,
      accountName ? `[${accountName}]에서 금액이 차감됩니다.` : '연결 계좌를 자산 탭에서 먼저 설정해주세요.',
    ].filter(Boolean) as string[]

    setConfirmModal({
      title: '💳 카드 납부',
      lines: infoLines,
      onConfirm: async () => {
        setConfirmModal(null)
        if (!matchedCard) { setAlertMsg('자산 탭에서 카드를 먼저 등록해주세요.'); setTimeout(() => setAlertMsg(''), 3000); return }

    const today2 = dayjs().format('YYYY-MM-DD')
    const { data: newExp, error } = await supabase.from('expenses').insert({
      user_id: userId,
      name: `${payMethod} 카드 대금`,
      amount: remaining,
      category: '고정비',
      date: today2,
      payment_method: accountName || null,
      memo: `[카드납부] ${payMethod}`,
      type: 'expense',
      source: 'manual',
    }).select().single()
        if (error) { setAlertMsg('납부 처리 중 오류가 발생했어요.'); setTimeout(() => setAlertMsg(''), 3000); return }
        if (accountName) {
          const acc = accounts.find(a => a.name === accountName)
          if (acc) {
            await supabase.from('accounts').update({ balance: (acc.balance ?? 0) - remaining }).eq('id', acc.id)
            setAccounts(prev => prev.map(a => a.name === accountName ? { ...a, balance: (a.balance ?? 0) - remaining } : a))
          }
        }
        if (newExp) setExpenses(prev => [newExp as Expense, ...prev])
        try { localStorage.removeItem('sp_history_v2') } catch {}
      }
    })
  }

  async function deleteExpense(id: string) {
    // Optimistic: UI 먼저 업데이트
    const prev = expenses.find(e => e.id === id)
    setExpenses(es => es.filter(e => e.id !== id))
    setEditingExpense(null)
    try { localStorage.removeItem('sp_history_v2') } catch {}
    try { localStorage.removeItem('sp_home_v1') } catch {}
    try { localStorage.removeItem('sp_assets_v2') } catch {}
    try { localStorage.setItem('sp_assets_needs_refresh', '1') } catch {}
    const { error } = await supabase.from('expenses').delete().eq('id', id)
    if (error && prev) {
      // 실패 시 롤백
      setExpenses(es => [...es, prev])
    }
  }

  async function saveExpense(id: string, updates: Partial<Expense>) {
    // Optimistic: UI 먼저 업데이트
    const prev = expenses.find(e => e.id === id)
    setExpenses(es => es.map(e => e.id === id ? { ...e, ...updates } : e))
    setEditingExpense(null)
    setAlertMsg('✅ 저장됐어요')
    setTimeout(() => setAlertMsg(''), 1500)
    try { localStorage.removeItem('sp_history_v2') } catch {}
    try { localStorage.removeItem('sp_home_v1') } catch {}
    try { localStorage.removeItem('sp_assets_v2') } catch {}
    try { localStorage.setItem('sp_assets_needs_refresh', '1') } catch {}
    const { error } = await supabase.from('expenses').update(updates).eq('id', id)
    if (error && prev) {
      setExpenses(es => es.map(e => e.id === id ? prev : e))
      setAlertMsg('저장 중 오류가 발생했어요')
      setTimeout(() => setAlertMsg(''), 2000)
    }
  }

  async function saveTransfer(id: string, updates: Partial<Expense>, oldFromName: string, oldToName: string, newFromName: string, newToName: string, oldAmt: number, newAmt: number) {
    const prev = expenses.find(e => e.id === id)
    setExpenses(es => es.map(e => e.id === id ? { ...e, ...updates } : e))
    setEditingExpense(null)
    const { error } = await supabase.from('expenses').update(updates).eq('id', id)
    if (error && prev) {
      setExpenses(es => es.map(e => e.id === id ? prev : e))
      return
    }
    // 계좌 잔액 변동 계산 (롤백 + 신규 적용)
    const delta: Record<string, number> = {}
    const find = (name: string) => accounts.find(a => a.name === name)
    const oldFrom = find(oldFromName); const oldTo = find(oldToName)
    const newFrom = find(newFromName); const newTo = find(newToName)
    if (oldFrom) delta[oldFrom.id] = (delta[oldFrom.id] ?? 0) + oldAmt   // 출금 롤백
    if (oldTo)   delta[oldTo.id]   = (delta[oldTo.id]   ?? 0) - oldAmt   // 입금 롤백
    if (newFrom) delta[newFrom.id] = (delta[newFrom.id] ?? 0) - newAmt   // 신규 출금
    if (newTo)   delta[newTo.id]   = (delta[newTo.id]   ?? 0) + newAmt   // 신규 입금
    for (const acc of accounts) {
      if (delta[acc.id] !== undefined && delta[acc.id] !== 0) {
        await supabase.from('accounts').update({ balance: (acc.balance ?? 0) + delta[acc.id] }).eq('id', acc.id)
      }
    }
    setAccounts(prev => prev.map(a => delta[a.id] !== undefined ? { ...a, balance: (a.balance ?? 0) + delta[a.id] } : a))
  }

  const today = dayjs().format('YYYY-MM-DD')
  const hasFilter = !!(search || filterCat || filterPay || filterType)

  return (
    <div className="min-h-screen pb-20" style={{ background: 'var(--color-bg)' }}>
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold" style={{ color: 'var(--color-accent)' }}>내역</h1>
        <div className="flex items-center gap-2">
          <div className="flex rounded-full p-0.5 gap-0.5" style={{ background: 'var(--color-primary-light)' }}>
            {(['list', 'calendar'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className="px-3 py-1.5 rounded-full text-xs font-semibold transition-colors"
                style={{ background: view === v ? 'var(--color-primary)' : 'transparent', color: view === v ? '#fff' : 'var(--color-primary)' }}>
                {v === 'list' ? '≡ 리스트' : '캘린더'}
              </button>
            ))}
          </div>
          <a href="/add"
            className="w-8 h-8 flex items-center justify-center rounded-full text-white text-lg font-bold"
            style={{ background: 'var(--color-primary)' }}>+</a>
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
          <option value="transfer">이체</option>
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
                      if (net > 0) return <span className="text-red-500">-{net.toLocaleString()}원</span>
                      if (net < 0) return <span className="text-emerald-500">+{Math.abs(net).toLocaleString()}원</span>
                      return null
                    })()}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  {items.map((e, idx) => (
                    <div key={e.id}>
                      <ExpenseRow expense={e} onTap={() => setEditingExpense(e)} onPayCard={handleCardPayment} accountNames={new Set(accounts.map(a => a.name))} />
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
          expenses={expenses} onEdit={setEditingExpense}
          accounts={accounts} onPayCard={handleCardPayment}
        />
      )}
      {/* 커스텀 카드 납부 확인 모달 */}
      {confirmModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px 20px 0 0', padding: '28px 24px 36px', width: '100%', maxWidth: 480, boxShadow: '0 -4px 32px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 18, color: '#111827' }}>{confirmModal.title}</div>
            <div style={{ marginBottom: 18, padding: '16px', background: '#f9fafb', borderRadius: 14 }}>
              {confirmModal.lines.map((line, i) => (
                <p key={i} style={{ fontSize: 14, color: '#374151', marginBottom: i < confirmModal.lines.length - 1 ? 6 : 0, lineHeight: 1.6 }}>{line}</p>
              ))}
            </div>
            <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', marginBottom: 20, textAlign: 'center' }}>납부하시겠어요?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={() => setConfirmModal(null)}
                style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: '1px solid #e5e7eb', background: '#f3f4f6', fontSize: 15, fontWeight: 600, color: '#6b7280', cursor: 'pointer' }}
              >취소</button>
              <button
                onClick={() => confirmModal.onConfirm()}
                style={{ flex: 1, padding: '14px 0', borderRadius: 14, border: 'none', background: 'var(--color-primary, #7c3aed)', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
              >납부</button>
            </div>
          </div>
        </div>
      )}
      {/* 수정 바텀시트 모달 */}
      {editingExpense && (
        <div
          style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 500, display: 'flex', alignItems: 'flex-end' }}
          onClick={e => { if (e.target === e.currentTarget) setEditingExpense(null) }}
        >
          <div style={{ backgroundColor: '#fff', borderRadius: '20px 20px 0 0', width: '100%', maxHeight: '85vh', overflowY: 'auto', padding: '20px 20px 48px' }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', margin: '0 auto 20px' }} />
            {(editingExpense.type === 'savings' || editingExpense.type === 'transfer')
              ? <TransferEditRow
                  expense={editingExpense}
                  accounts={accounts}
                  onSaveTransfer={(upd,of,ot,nf,nt,oa,na) => { saveTransfer(editingExpense.id,upd,of,ot,nf,nt,oa,na); setEditingExpense(null) }}
                  onDelete={() => { deleteExpense(editingExpense.id); setEditingExpense(null) }}
                  onCancel={() => setEditingExpense(null)}
                />
              : <EditRow
                  expense={editingExpense}
                  onSave={u => { saveExpense(editingExpense.id, u); setEditingExpense(null) }}
                  onDelete={() => { deleteExpense(editingExpense.id); setEditingExpense(null) }}
                  onCancel={() => setEditingExpense(null)}
                  paymentMethods={paymentMethods}
                  userCategories={userCategories}
                  cards={cards}
                  accounts={accounts}
                />
            }
          </div>
        </div>
      )}
      {/* 알림 토스트 */}
      {alertMsg && (
        <div style={{ position: 'fixed', bottom: 88, left: '50%', transform: 'translateX(-50%)', background: '#1f2937', color: '#fff', padding: '11px 22px', borderRadius: 999, fontSize: 13, fontWeight: 500, zIndex: 9999, whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
          {alertMsg}
        </div>
      )}
    </div>
  )
}

function ExpenseRow({ expense, onTap, onPayCard, accountNames = new Set<string>() }: { expense: Expense; onTap: () => void; onPayCard?: (e: Expense) => void; accountNames?: Set<string> }) {
  const type = expense.type ?? 'expense'
  const isIncome = type === 'income'
  const isTransfer = type === 'transfer' || type === 'savings'
  const isCard = !isIncome && !isTransfer && !accountNames.has(expense.payment_method ?? '') && (expense.payment_method ?? '').includes('카드')

  if (isTransfer) {
    const parts = expense.name.includes('→') ? expense.name.split('→').map((s: string) => s.trim()) : [expense.name, '']
    const fromAcc = parts[0]
    const toAcc = parts[1] || ''
    return (
      <button onClick={onTap} className="w-full p-4 text-left transition-colors" style={{ background: 'rgba(245,243,255,0.6)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#ede9fe', color: '#7c3aed' }}>🔄 이체</span>
            </div>
            <p className="text-sm font-semibold text-gray-800">
              {fromAcc}{toAcc && <span className="text-gray-400 font-normal"> → {toAcc}</span>}
            </p>
          </div>
          <span className="text-sm font-bold" style={{ color: '#7c3aed' }}>⇔ {expense.amount.toLocaleString()}원</span>
        </div>
      </button>
    )
  }

  if (isCard) {
    return (
      <div className="w-full p-4" style={{ background: 'rgba(254,242,242,0.7)' }}>
        <div className="flex items-start justify-between">
          <button onClick={onTap} className="flex-1 text-left min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#fecaca', color: '#b91c1c' }}>💳 카드</span>
            </div>
            <p className="text-sm font-semibold text-gray-800">{expense.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{expense.category}{expense.payment_method && ` · ${expense.payment_method}`}</p>
          </button>
          <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
            <span className="text-sm font-bold" style={{ color: '#f97316' }}>-{expense.amount.toLocaleString()}원</span>
            {onPayCard && (
              <button
                onClick={e => { e.stopPropagation(); onPayCard(expense) }}
                className="text-[10px] px-2 py-0.5 rounded-md font-semibold"
                style={{ background: '#fed7aa', color: '#c2410c', border: '1px solid #fdba74' }}
              >납부</button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <button onClick={onTap} className="w-full flex justify-between items-center p-4 text-left hover:bg-gray-50 transition-colors">
      <div>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-gray-800">{expense.name}</p>
          {isIncome && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-600 font-semibold">수입</span>}
        </div>
        <p className="text-xs text-gray-400 mt-0.5">{expense.category}{expense.payment_method && ` · ${expense.payment_method}`}</p>
      </div>
      <span className={`text-sm font-bold ${isIncome ? 'text-emerald-500' : 'text-red-500'}`}>
        {isIncome ? '+' : '-'}{expense.amount.toLocaleString()}원
      </span>
    </button>
  )
}

// ─── 커스텀 드롭다운 (web 전용) ────────────────────────────────────────────
type WebGroupedItem = { type: 'header'; label: string } | { type: 'item'; label: string; value: string }

function WebDropdownPicker({ value, options, onChange, placeholder = '선택하세요' }: {
  value: string; options: string[]; onChange: (v: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const PANEL_MAX_H = 220

  function handleToggle() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      if (spaceBelow >= PANEL_MAX_H) {
        setPanelPos({ top: r.bottom + 2, left: r.left, width: r.width })
      } else {
        setPanelPos({ bottom: window.innerHeight - r.top + 2, left: r.left, width: r.width })
      }
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
          background: '#f9fafb', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
          color: value ? '#1f2937' : '#9ca3af' }}
      >
        <span>{value || placeholder}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 600 }} />
          <div style={{
            position: 'fixed', top: panelPos.top, bottom: panelPos.bottom,
            left: panelPos.left, width: panelPos.width,
            backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            zIndex: 601, maxHeight: PANEL_MAX_H, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
          }}>
            {options.map(opt => (
              <button key={opt} type="button"
                onClick={() => { onChange(opt); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px',
                  fontSize: 14, background: value === opt ? 'var(--color-primary)' : '#fff',
                  color: value === opt ? '#fff' : '#374151', border: 'none', cursor: 'pointer',
                  fontFamily: 'inherit', borderBottom: '1px solid #f3f4f6' }}>
                {opt}{value === opt ? ' ✓' : ''}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function WebGroupedDropdownPicker({ value, items, onChange, placeholder = '선택하세요' }: {
  value: string; items: WebGroupedItem[]; onChange: (v: string) => void; placeholder?: string
}) {
  const [open, setOpen] = useState(false)
  const [panelPos, setPanelPos] = useState<{ top?: number; bottom?: number; left: number; width: number }>({ left: 0, width: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const PANEL_MAX_H = 260
  const selected = items.find(i => i.type === 'item' && i.value === value) as { type: 'item'; label: string; value: string } | undefined

  function handleToggle() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const spaceBelow = window.innerHeight - r.bottom
      if (spaceBelow >= PANEL_MAX_H) {
        setPanelPos({ top: r.bottom + 2, left: r.left, width: r.width })
      } else {
        setPanelPos({ bottom: window.innerHeight - r.top + 2, left: r.left, width: r.width })
      }
    }
    setOpen(o => !o)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
          background: '#f9fafb', fontSize: 16, cursor: 'pointer', fontFamily: 'inherit',
          color: selected ? '#1f2937' : '#9ca3af' }}
      >
        <span>{selected ? selected.label : placeholder}</span>
        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 8 }}>▾</span>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 600 }} />
          <div style={{
            position: 'fixed', top: panelPos.top, bottom: panelPos.bottom,
            left: panelPos.left, width: panelPos.width,
            backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 8,
            zIndex: 601, maxHeight: PANEL_MAX_H, overflowY: 'auto',
            boxShadow: '0 4px 12px rgba(0,0,0,0.12)'
          }}>
            {items.map((item, idx) => {
              if (item.type === 'header') {
                return (
                  <div key={`h-${idx}`} style={{ padding: '6px 14px 4px', fontSize: 11, fontWeight: 700,
                    color: '#6b7280', background: '#f9fafb', borderBottom: '1px solid #f3f4f6', letterSpacing: '0.05em' }}>
                    {item.label}
                  </div>
                )
              }
              const active = value === item.value
              return (
                <button key={item.value} type="button"
                  onClick={() => { onChange(item.value); setOpen(false) }}
                  style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px 10px 24px',
                    fontSize: 14, background: active ? 'var(--color-primary)' : '#fff',
                    color: active ? '#fff' : '#374151', border: 'none', cursor: 'pointer',
                    fontFamily: 'inherit', borderBottom: '1px solid #f3f4f6' }}>
                  {item.label}{active ? ' ✓' : ''}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function EditRow({ expense, onSave, onDelete, onCancel, userCategories, paymentMethods, cards, accounts }: {
  expense: Expense
  onSave: (updates: Partial<Expense>) => void
  onDelete: () => void
  onCancel: () => void
  userCategories?: string[]
  paymentMethods: string[]
  cards: {name:string}[]
  accounts: {id:string;name:string;balance:number}[]
}) {
  const [form, setForm] = useState({ ...expense, type: expense.type ?? 'expense', amount: expense.amount.toLocaleString(), payment_method: expense.payment_method ?? '' })
  function u(k: string, v: string) { setForm(f => ({ ...f, [k]: v })) }

  const catOptions = [...(userCategories && userCategories.length > 0 ? userCategories : (CATEGORIES as readonly string[])), '없음']

  // 결제수단 그룹 아이템
  const payItems: WebGroupedItem[] = [{ type: 'item', label: '없음', value: '' }]
  if (cards.length > 0) {
    payItems.push({ type: 'header', label: '카드' })
    ;[...cards].sort((a, b) => a.name.localeCompare(b.name)).forEach(c => payItems.push({ type: 'item', label: c.name, value: c.name }))
  }
  if (accounts.length > 0) {
    payItems.push({ type: 'header', label: '계좌' })
    ;[...accounts].sort((a, b) => a.name.localeCompare(b.name)).forEach(a => payItems.push({ type: 'item', label: a.name, value: a.name }))
  }
  payItems.push({ type: 'header', label: '기타 수단' })
  ;['현금', '기타'].forEach(m => payItems.push({ type: 'item', label: m, value: m }))

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }

  return (
    <div>
      {/* 헤더: 날짜 + 삭제 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#6b7280' }}>{dayjs(expense.date).format('M월 D일')}</span>
        <button
          type="button"
          onClick={() => { if (window.confirm('삭제하시겠습니까?')) onDelete() }}
          style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: '#fef2f2',
            border: '1px solid #fecdd3', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}
        >삭제</button>
      </div>
      {/* 지출/수입 토글 */}
      <div style={{ display: 'flex', background: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 2, marginBottom: 10 }}>
        {(['expense', 'income'] as const).map(t => (
          <button key={t} type="button" onClick={() => u('type', t)}
            style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              background: form.type === t ? 'var(--color-primary)' : 'transparent',
              color: form.type === t ? '#fff' : '#9ca3af' }}>
            {t === 'expense' ? '💸 지출' : '💰 수입'}
          </button>
        ))}
      </div>
      {/* 항목명 */}
      <input value={form.name} onChange={e => u('name', e.target.value)}
        style={{ ...inputStyle, marginBottom: 8 }} placeholder="항목명" />
      {/* 금액 + 원 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input type="text" inputMode="numeric" value={form.amount}
          onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); u('amount', n ? Number(n).toLocaleString() : '') }}
          style={{ ...inputStyle, flex: 1, marginBottom: 0 }} placeholder="0" />
        <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>원</span>
      </div>
      {/* 카테고리 + 날짜 2열 */}
      <div style={{ display: 'grid', gridTemplateColumns: form.type !== 'income' ? '1fr 1fr' : '1fr', gap: 8, marginBottom: 8 }}>
        {form.type !== 'income' && (
          <WebDropdownPicker
            value={form.category}
            options={catOptions as string[]}
            onChange={v => u('category', v)}
            placeholder="카테고리"
          />
        )}
        <input type="date" value={form.date} onChange={e => u('date', e.target.value)}
          style={{ ...inputStyle }} />
      </div>
      {/* 결제수단 */}
      <div style={{ marginBottom: 16 }}>
        <WebGroupedDropdownPicker
          value={form.payment_method}
          items={payItems}
          onChange={v => u('payment_method', v)}
          placeholder="결제수단 없음"
        />
        {form.payment_method && (
          <button type="button" onClick={() => u('payment_method', '')}
            style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', marginTop: 4, padding: 0 }}>
            ✕ 선택 해제
          </button>
        )}
      </div>
      {/* 저장 / 취소 */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => onSave({
          name: form.name,
          amount: parseInt(form.amount.replace(/,/g, '')) || expense.amount,
          category: (!form.category || form.category === '없음' ? null : form.category) as any,
          date: form.date,
          payment_method: form.payment_method || null,
          type: form.type as 'expense' | 'income',
        })} style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: 'var(--color-primary)',
          fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        <button type="button" onClick={onCancel}
          style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 14, fontWeight: 600, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
}

function TransferEditRow({ expense, accounts, onSaveTransfer, onDelete, onCancel }: {
  expense: Expense
  accounts: {id:string;name:string;balance:number}[]
  onSaveTransfer: (upd: Partial<Expense>, oldFrom: string, oldTo: string, newFrom: string, newTo: string, oldAmt: number, newAmt: number) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const parts = expense.name.includes('→') ? expense.name.split('→').map((s: string) => s.trim()) : [expense.name, '']
  const origFrom = parts[0] || expense.payment_method || ''
  const origTo = parts[1] || expense.memo?.replace('[이체] ', '') || ''
  const [fromAcc, setFromAcc] = useState(origFrom)
  const [toAcc, setToAcc] = useState(origTo)
  const [amount, setAmount] = useState(expense.amount.toLocaleString())
  const [date, setDate] = useState(expense.date)

  function handleSave() {
    const newAmt = parseInt(amount.replace(/,/g, '')) || expense.amount
    const newName = toAcc ? `${fromAcc} → ${toAcc}` : fromAcc
    onSaveTransfer(
      { name: newName, amount: newAmt, date, payment_method: fromAcc, memo: toAcc ? `[이체] ${toAcc}` : null },
      origFrom, origTo, fromAcc, toAcc, expense.amount, newAmt
    )
  }

  const accNames = accounts.map(a => a.name)
  const selectStyle = { border: '1px solid #ddd6fe', background: 'white', borderRadius: 12, padding: '8px 12px', fontSize: 14, width: '100%', outline: 'none', appearance: 'none' as const, color: '#374151' }

  const inputStyle = { width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #ddd6fe', fontSize: 16, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const, background: '#fff' }

  return (
    <div>
      {/* 헤더: 이체 배지 + 삭제 버튼 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 999, fontWeight: 700, background: '#ede9fe', color: '#7c3aed' }}>🔄 이체</span>
        <button type="button"
          onClick={() => { if (window.confirm('삭제하시겠습니까?')) onDelete() }}
          style={{ fontSize: 12, fontWeight: 600, color: '#ef4444', background: '#fef2f2',
            border: '1px solid #fecdd3', borderRadius: 8, padding: '4px 10px', cursor: 'pointer' }}>삭제</button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <select value={fromAcc} onChange={e => setFromAcc(e.target.value)} style={{ ...selectStyle, fontSize: 16 }}>
          {origFrom && !accNames.includes(origFrom) && <option value={origFrom}>{origFrom}</option>}
          {accNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <span style={{ color: '#9ca3af', flexShrink: 0 }}>→</span>
        <select value={toAcc} onChange={e => setToAcc(e.target.value)} style={{ ...selectStyle, fontSize: 16 }}>
          {origTo && !accNames.includes(origTo) && <option value={origTo}>{origTo}</option>}
          {accNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input type="text" inputMode="numeric" value={amount}
          onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); setAmount(n ? Number(n).toLocaleString() : '') }}
          style={{ ...inputStyle, flex: 1 }} placeholder="금액" />
        <span style={{ fontSize: 14, color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>원</span>
      </div>
      <input type="date" value={date} onChange={e => setDate(e.target.value)}
        style={{ ...inputStyle, marginBottom: 16 }} />
      <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>* 금액 수정 시 계좌 잔액은 자동 반영되지 않아요</p>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={handleSave}
          style={{ flex: 1, padding: '12px 0', borderRadius: 10, border: 'none', background: '#7c3aed',
            fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', fontFamily: 'inherit' }}>저장</button>
        <button type="button" onClick={onCancel}
          style={{ padding: '12px 20px', borderRadius: 10, border: '1px solid #e5e7eb', background: '#fff',
            fontSize: 14, fontWeight: 600, color: '#6b7280', cursor: 'pointer', fontFamily: 'inherit' }}>취소</button>
      </div>
    </div>
  )
}


function CalendarView({ calMonth, onChangeMonth, calExpenseMap, calIncomeSet, today, selectedDate, onSelectDate, expenses, onEdit, accounts, onPayCard }: {
  calMonth: string; onChangeMonth: (m: string) => void; calExpenseMap: Map<string, number>; calIncomeSet: Set<string>
  today: string; selectedDate: string | null; onSelectDate: (d: string) => void
  expenses: Expense[]; onEdit: (e: Expense) => void
  accounts: {id:string;name:string;balance:number}[]
  onPayCard?: (e: Expense) => void
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
                  {amt ? <span className="text-[9px] font-bold text-red-500">-{amt >= 1000000 ? `${(amt/1000000).toFixed(1)}M` : amt >= 10000 ? `${Math.round(amt/1000)}k` : amt.toLocaleString()}</span> : null}
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
            <span className="text-sm font-bold text-red-500">
              {selectedItems.filter(e => (e.type ?? 'expense') !== 'income').length > 0
                ? `-${selectedItems.filter(e => (e.type ?? 'expense') !== 'income').reduce((s, e) => s + e.amount, 0).toLocaleString()}원`
                : ''}
            </span>
          </div>
          {selectedItems.length === 0
            ? <p className="text-center text-sm text-gray-400 py-8">이날은 내역이 없었어요 🌿</p>
            : selectedItems.map((e, idx) => (
              <div key={e.id}>
                <ExpenseRow expense={e} onTap={() => onEdit(e)} onPayCard={onPayCard} accountNames={new Set(accounts.map(a => a.name))} />
                {idx < selectedItems.length - 1 && <div className="h-px bg-gray-50 mx-4" />}
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

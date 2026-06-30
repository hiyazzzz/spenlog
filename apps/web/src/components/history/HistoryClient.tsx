'use client'
import { useState, useMemo, useEffect } from 'react'
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
  const [editingId, setEditingId] = useState<string | null>(null)
  const pathname = usePathname()
  // 다른 탭으로 이동 시 인라인 수정 폼 닫기
  useEffect(() => {
    if (pathname !== '/history') setEditingId(null)
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
    setEditingId(null)
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
    setEditingId(null)
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
    setEditingId(null)
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
                      {editingId === e.id
                        ? ((e.type === 'savings' || e.type === 'transfer')
                            ? <TransferEditRow expense={e} accounts={accounts} onSaveTransfer={(upd,of,ot,nf,nt,oa,na) => saveTransfer(e.id,upd,of,ot,nf,nt,oa,na)} onDelete={() => deleteExpense(e.id)} onCancel={() => setEditingId(null)} />
                            : <EditRow expense={e} onSave={u => saveExpense(e.id, u)} onDelete={() => deleteExpense(e.id)} onCancel={() => setEditingId(null)} paymentMethods={paymentMethods} userCategories={userCategories} cards={cards} accounts={accounts} />)
                        : <ExpenseRow expense={e} onTap={() => setEditingId(e.id)} onPayCard={handleCardPayment} accountNames={new Set(accounts.map(a => a.name))} />
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
          accounts={accounts} cards={cards} onSaveTransfer={(id,upd,of,ot,nf,nt,oa,na) => saveTransfer(id,upd,of,ot,nf,nt,oa,na)}
          onPayCard={handleCardPayment}
          paymentMethods={paymentMethods} userCategories={userCategories}
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
          <select value={form.category} onChange={e => u('category', e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none cursor-pointer">
            {(userCategories && userCategories.length > 0 ? userCategories : (CATEGORIES as readonly string[])).map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        )}
        <input type="date" value={form.date} onChange={e => u('date', e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none" />
        <div>
          <p className="text-[11px] text-gray-400 mb-1">결제수단</p>
          <select value={form.payment_method} onChange={e => u('payment_method', e.target.value)}
            className="w-full text-sm px-3 py-2 rounded-xl bg-white border border-gray-200 outline-none cursor-pointer">
            <option value="">선택 안 함 (없음)</option>
            {cards.length > 0 && (
              <optgroup label="카드">
                {[...cards].sort((a, b) => a.name.localeCompare(b.name)).map(c => (
                  <option key={c.name} value={c.name}>{c.name}</option>
                ))}
              </optgroup>
            )}
            {accounts.length > 0 && (
              <optgroup label="계좌">
                {[...accounts].sort((a, b) => a.name.localeCompare(b.name)).map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </optgroup>
            )}
            <optgroup label="기타 수단">
              <option value="현금">현금</option>
              <option value="기타">기타</option>
            </optgroup>
          </select>
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

function TransferEditRow({ expense, accounts, onSaveTransfer, onDelete, onCancel }: {
  expense: Expense
  accounts: {id:string;name:string;balance:number}[]
  onSaveTransfer: (upd: Partial<Expense>, oldFrom: string, oldTo: string, newFrom: string, newTo: string, oldAmt: number, newAmt: number) => void
  onDelete: () => void
  onCancel: () => void
}) {
  const parts = expense.name.includes('→') ? expense.name.split('→').map((s: string) => s.trim()) : [expense.name, '']
  const origFrom = parts[0]
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

  return (
    <div className="p-4" style={{ background: '#f5f3ff' }}>
      <div className="flex justify-between items-center mb-3">
        <span className="text-[9px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: '#ede9fe', color: '#7c3aed' }}>🔄 이체</span>
        <button onClick={onCancel} className="text-xs text-gray-400">✕</button>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <select value={fromAcc} onChange={e => setFromAcc(e.target.value)} style={selectStyle}>
              {accNames.length === 0 && <option value={origFrom}>{origFrom}</option>}
              {accNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <span className="text-gray-400 text-sm flex-shrink-0">→</span>
          <div className="flex-1 relative">
            <select value={toAcc} onChange={e => setToAcc(e.target.value)} style={selectStyle}>
              {accNames.length === 0 && <option value={origTo}>{origTo}</option>}
              {accNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
        <input type="text" inputMode="numeric" value={amount}
          onChange={e => { const n = e.target.value.replace(/[^0-9]/g, ''); setAmount(n ? Number(n).toLocaleString() : '') }}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white outline-none" style={{ border: '1px solid #ddd6fe' }} placeholder="금액" />
        <input type="date" value={date} onChange={e => setDate(e.target.value)}
          className="w-full text-sm px-3 py-2 rounded-xl bg-white outline-none" style={{ border: '1px solid #ddd6fe' }} />
      </div>
      <div className="flex gap-2 mt-3">
        <button onClick={handleSave} className="flex-1 py-2 rounded-xl text-sm font-semibold text-white" style={{ background: '#7c3aed' }}>저장</button>
        <button onClick={onDelete} className="px-4 py-2 rounded-xl text-sm font-semibold bg-rose-50 text-rose-400 border border-rose-100">삭제</button>
      </div>
    </div>
  )
}


function CalendarView({ calMonth, onChangeMonth, calExpenseMap, calIncomeSet, today, selectedDate, onSelectDate, expenses, editingId, onEdit, onSave, onDelete, onCancelEdit, accounts, cards, onSaveTransfer, onPayCard, paymentMethods, userCategories }: {
  calMonth: string; onChangeMonth: (m: string) => void; calExpenseMap: Map<string, number>; calIncomeSet: Set<string>
  today: string; selectedDate: string | null; onSelectDate: (d: string) => void
  expenses: Expense[]; editingId: string | null; onEdit: (id: string) => void
  onSave: (id: string, u: Partial<Expense>) => void; onDelete: (id: string) => void; onCancelEdit: () => void
  accounts: {id:string;name:string;balance:number}[]; cards: {name:string}[]
  onSaveTransfer: (id: string, upd: Partial<Expense>, of:string, ot:string, nf:string, nt:string, oa:number, na:number) => void
  onPayCard?: (e: Expense) => void
  paymentMethods: string[]; userCategories?: string[]
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
                {editingId === e.id
                  ? ((e.type === 'savings' || e.type === 'transfer')
                      ? <TransferEditRow expense={e} accounts={accounts} onSaveTransfer={(upd,of,ot,nf,nt,oa,na) => onSaveTransfer(e.id,upd,of,ot,nf,nt,oa,na)} onDelete={() => onDelete(e.id)} onCancel={onCancelEdit} />
                      : <EditRow expense={e} onSave={u => onSave(e.id, u)} onDelete={() => onDelete(e.id)} onCancel={onCancelEdit} paymentMethods={paymentMethods} userCategories={userCategories} cards={cards} accounts={accounts} />)
                  : <ExpenseRow expense={e} onTap={() => onEdit(e.id)} onPayCard={onPayCard} accountNames={new Set(accounts.map(a => a.name))} />
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

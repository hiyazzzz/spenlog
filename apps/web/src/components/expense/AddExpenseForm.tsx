'use client'
import { useState, useEffect } from 'react'
import { useAiInputStore } from '@/store/useAiInputStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import dayjs from 'dayjs'
import { TEXTS } from '@/config/texts'

// 지출 수단: 카드(등록된 카드 우선) + 직접결제 수단
const EXPENSE_METHODS = ['현금', '계좌이체', '카카오페이', '네이버페이', '토스페이', '제로페이']
// 수입 수단
const INCOME_METHODS = ['현금', '계좌이체']

interface Props {
  prefill?: { name?: string; amount?: number; category?: string; type?: 'expense' | 'income' | 'transfer' }
  userCategories?: string[]
}

function formatAmount(val: string): string {
  const num = val.replace(/[^0-9]/g, '')
  if (!num) return ''
  return Number(num).toLocaleString()
}

export default function AddExpenseForm({ prefill, userCategories }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { prefill: storePrefill, clearPrefill } = useAiInputStore()
  // props prefill 우선, 없으면 store prefill
  const effectivePrefill = prefill ?? storePrefill
  const [type, setType] = useState<'expense' | 'income' | 'transfer'>(prefill?.type ?? 'expense')
  const [transferFrom, setTransferFrom] = useState('')
  const [transferTo, setTransferTo] = useState('')
  const [form, setForm] = useState({
    name: effectivePrefill?.name ?? '',
    amount: effectivePrefill?.amount ? effectivePrefill.amount.toLocaleString() : '',
    category: prefill?.category ?? '생활비',
    date: dayjs().format('YYYY-MM-DD'),
    payment_method: '',
    memo: '',
  })
  const [cards, setCards] = useState<{ name: string }[]>([])
  const [accounts, setAccounts] = useState<{ id: string; name: string; balance: number }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.from('cards').select('name').then(({ data }) => { if (data) setCards(data) })
    supabase.from('accounts').select('id, name, balance').then(({ data }) => { if (data) setAccounts(data) })
  }, [])

  function update(key: string, value: string) {
    setError('')
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handleSave() {
    const amount = parseInt(form.amount.replace(/,/g, ''))
    // 공통 검증
    if (!amount || amount <= 0) { setError(TEXTS.addExpense.errAmount); return }
    if (type === 'transfer') {
      if (!transferFrom) { setError('출금 계좌를 선택하세요'); return }
      if (!transferTo) { setError('입금 계좌를 선택하세요'); return }
    } else {
      if (!form.name.trim()) { setError(TEXTS.addExpense.errName); return }
      // 결제수단 없이 저장 허용 (기타/미선택)
    }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      // ── 이체 ────────────────────────────────────────────────
      if (type === 'transfer') {
        const fromAcc = accounts.find(a => a.name === transferFrom)
        const toAcc = accounts.find(a => a.name === transferTo)
        const { error: saveErr } = await supabase.from('expenses').insert({
          user_id: user.id, name: `${transferFrom} → ${transferTo}`, amount,
          category: '고정비', date: form.date,
          payment_method: transferFrom,
          memo: `[이체] ${transferTo}`,
          source: 'manual', type: 'savings',
        })
        if (saveErr) throw saveErr
        if (fromAcc) await supabase.from('accounts').update({ balance: (fromAcc.balance ?? 0) - amount }).eq('id', fromAcc.id)
        if (toAcc) await supabase.from('accounts').update({ balance: (toAcc.balance ?? 0) + amount }).eq('id', toAcc.id)
        clearPrefill()
        showToast('이체 기록 완료')
        setForm({ name: '', amount: '', category: '생활비', date: dayjs().format('YYYY-MM-DD'), payment_method: '', memo: '' })
        setTransferFrom(''); setTransferTo('')
        setTimeout(() => router.push('/history'), 1000)
        return
      }
      if (type === 'expense') {
        const { error: saveErr } = await supabase.from('expenses').insert({
          user_id: user.id, name: form.name.trim(), amount,
          category: form.category, date: form.date,
          payment_method: form.payment_method || null,
          memo: form.memo || null, source: 'manual', type: 'expense',
        })
        if (saveErr) {
          if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem('spenlog_offline_queue') || '[]')
            queue.push({ name: form.name.trim(), amount, category: form.category, date: form.date, payment_method: form.payment_method || null, memo: form.memo || null, source: 'manual', type: 'expense' })
            localStorage.setItem('spenlog_offline_queue', JSON.stringify(queue))
            showToast(TEXTS.addExpense.toastOffline)
          } else {
            throw saveErr
          }
        }
      } else {
        // 수입은 expenses 테이블에 type='income'으로 저장 (통합 스키마)
        const { error: saveErr } = await supabase.from('expenses').insert({
          user_id: user.id, name: form.name.trim(), amount,
          category: '수입', date: form.date,
          payment_method: null, memo: form.memo || null,
          source: 'manual', type: 'income',
        })
        if (saveErr) throw saveErr
      }
      // 계좌 결제 시 잔액 즉시 변동
      const selectedAccount = accounts.find(a => a.name === form.payment_method)
      if (selectedAccount) {
        const delta = type === 'income' ? amount : -amount
        await supabase.from('accounts')
          .update({ balance: (selectedAccount.balance ?? 0) + delta })
          .eq('id', selectedAccount.id)
      }
      clearPrefill()
      showToast(type === 'expense' ? TEXTS.addExpense.toastSavedExpense : TEXTS.addExpense.toastSavedIncome)
      setForm({ name: '', amount: '', category: '생활비', date: dayjs().format('YYYY-MM-DD'), payment_method: '', memo: '' })
      // 1초 후 내역 탭으로 이동
      setTimeout(() => router.push('/history'), 1000)
    } catch { setError(TEXTS.addExpense.errSave) }
    finally { setSaving(false) }
  }

  const accountNames = accounts.map(a => a.name)
  const paymentOptions = type === 'income'
    ? [...accountNames, ...INCOME_METHODS.filter(m => !accountNames.includes(m))]
    : [...cards.map(c => c.name), ...accountNames.filter(n => !cards.some(c => c.name === n)), ...EXPENSE_METHODS.filter(m => !cards.some(c => c.name === m) && !accountNames.includes(m)), '기타']

  return (
    <div className="space-y-3 relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex bg-white rounded-2xl border border-gray-100 p-1">
        {(['expense', 'income', 'transfer'] as const).map(t => (
          <button key={t} onClick={() => { setType(t as any); setError(''); setTransferFrom(''); setTransferTo('') }}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: type === t ? 'var(--color-primary)' : 'transparent', color: type === t ? 'white' : '#9ca3af' }}>
            {t === 'expense' ? TEXTS.addExpense.tabExpense : t === 'income' ? TEXTS.addExpense.tabIncome : '🔄 이체'}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">{TEXTS.addExpense.labelAmount}</label>
        <div className="flex items-center">
          <input className="w-full text-lg font-bold outline-none text-gray-800"
            placeholder="0" inputMode="numeric" value={form.amount}
            onChange={e => update('amount', formatAmount(e.target.value))} autoFocus />
        </div>
      </div>
      {type !== 'transfer' && <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">
          {type === 'expense' ? TEXTS.addExpense.labelNameExpense : TEXTS.addExpense.labelNameIncome}
        </label>
        <input className="w-full text-sm outline-none text-gray-800"
          placeholder={type === 'expense' ? TEXTS.addExpense.namePlaceholderExpense : TEXTS.addExpense.namePlaceholderIncome}
          value={form.name} onChange={e => update('name', e.target.value)} />
      </div>}
      {type === 'expense' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <label className="text-xs text-gray-400 mb-2 block">{TEXTS.addExpense.labelCategory}</label>
          <div className="flex flex-wrap gap-2">
            {(userCategories && userCategories.length > 0 ? userCategories : (CATEGORIES as readonly string[])).map(cat => (
              <button key={cat} onClick={() => update('category', cat)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{ background: form.category === cat ? 'var(--color-primary)' : '#f3f4f6', color: form.category === cat ? 'white' : '#6b7280' }}>
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">{TEXTS.addExpense.labelDate}</label>
        <input type="date" className="w-full text-sm outline-none text-gray-800"
          value={form.date} onChange={e => update('date', e.target.value)} />
      </div>
      {type === 'transfer' ? (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-2 block">출금 계좌 (돈이 나가는 곳) <span className="text-rose-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {accountNames.map(n => (
                <button key={n} onClick={() => setTransferFrom(n)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{ background: transferFrom === n ? 'var(--color-primary)' : '#f3f4f6', color: transferFrom === n ? 'white' : '#6b7280' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-2 block">입금 계좌 (돈이 들어오는 곳) <span className="text-rose-400">*</span></label>
            <div className="flex flex-wrap gap-2">
              {accountNames.map(n => (
                <button key={n} onClick={() => setTransferTo(n)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                  style={{ background: transferTo === n ? '#3b82f6' : '#f3f4f6', color: transferTo === n ? 'white' : '#6b7280' }}>
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <label className="text-xs text-gray-400 mb-2 block">{type === 'expense' ? TEXTS.addExpense.labelPaymentExpense : TEXTS.addExpense.labelPaymentIncome}</label>
          <select
            value={form.payment_method}
            onChange={e => update('payment_method', e.target.value)}
            className="w-full text-sm outline-none text-gray-800 bg-transparent cursor-pointer"
            style={{ appearance: 'auto' }}>
            <option value="">선택 안 함 (없음)</option>
            {paymentOptions.map(method => (
              <option key={method} value={method}>{method}</option>
            ))}
          </select>
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">{TEXTS.addExpense.labelMemo}</label>
        <input className="w-full text-sm outline-none text-gray-800"
          placeholder={TEXTS.addExpense.memoPh}
          value={form.memo} onChange={e => update('memo', e.target.value)} />
      </div>
      {error && <p className="text-xs text-rose-400 px-1">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full text-white py-3.5 rounded-2xl text-sm font-medium mt-2 disabled:opacity-60"
        style={{ background: 'var(--color-primary)' }}>
        {saving ? TEXTS.addExpense.btnSaving : type === 'transfer' ? '이체 기록' : type === 'expense' ? TEXTS.addExpense.btnSaveExpense : TEXTS.addExpense.btnSaveIncome}
      </button>
    </div>
  )
}
'use client'
import { useState, useEffect } from 'react'
import { useAiInputStore } from '@/store/useAiInputStore'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import dayjs from 'dayjs'

const PAYMENT_METHODS = ['카드', '현금', '카카오페이', '네이버페이', '토스', '계좌이체']

interface Props {
  prefill?: { name?: string; amount?: number; category?: string }
}

function formatAmount(val: string): string {
  const num = val.replace(/[^0-9]/g, '')
  if (!num) return ''
  return Number(num).toLocaleString()
}

export default function AddExpenseForm({ prefill }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const { prefill: storePrefill, clearPrefill } = useAiInputStore()
  // props prefill 우선, 없으면 store prefill
  const effectivePrefill = prefill ?? storePrefill
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [form, setForm] = useState({
    name: effectivePrefill?.name ?? '',
    amount: effectivePrefill?.amount ? effectivePrefill.amount.toLocaleString() : '',
    category: prefill?.category ?? '생활비',
    date: dayjs().format('YYYY-MM-DD'),
    payment_method: '',
    memo: '',
  })
  const [cards, setCards] = useState<{ name: string }[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    supabase.from('cards').select('name').then(({ data }) => {
      if (data) setCards(data)
    })
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
    if (!amount || amount <= 0) { setError('금액을 입력해주세요'); return }
    if (!form.name.trim()) { setError('항목명을 입력해주세요'); return }
    if (type === 'expense' && !form.category) { setError('카테고리를 선택해주세요'); return }
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (type === 'expense') {
        const { error: saveErr } = await supabase.from('expenses').insert({
          user_id: user.id, name: form.name.trim(), amount,
          category: form.category, date: form.date,
          payment_method: form.payment_method || null,
          memo: form.memo || null, source: 'manual',
        })
        if (saveErr) {
          if (!navigator.onLine) {
            const queue = JSON.parse(localStorage.getItem('spenlog_offline_queue') || '[]')
            queue.push({ name: form.name.trim(), amount, category: form.category, date: form.date, payment_method: form.payment_method || null, memo: form.memo || null, source: 'manual' })
            localStorage.setItem('spenlog_offline_queue', JSON.stringify(queue))
            showToast('임시 저장했어요. 인터넷 연결 후 자동 반영돼요')
          } else {
            throw saveErr
          }
        }
      } else {
        const { error: saveErr } = await supabase.from('incomes').insert({
          user_id: user.id, name: form.name.trim(), amount,
          date: form.date, memo: form.memo || null, source: 'manual',
        })
        if (saveErr) throw saveErr
      }
      clearPrefill() // AI fallback store 클리어
      showToast(type === 'expense' ? '지출이 저장됐어요!' : '수입이 저장됐어요!')
      setForm({ name: '', amount: '', category: '생활비', date: dayjs().format('YYYY-MM-DD'), payment_method: '', memo: '' })
      router.refresh()
    } catch { setError('저장 중 오류가 발생했어요') }
    finally { setSaving(false) }
  }

  const paymentOptions = [
    ...cards.map(c => c.name),
    ...PAYMENT_METHODS.filter(m => !cards.some(c => c.name === m)),
  ]

  return (
    <div className="space-y-3 relative">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}
      <div className="flex bg-white rounded-2xl border border-gray-100 p-1">
        {(['expense', 'income'] as const).map(t => (
          <button key={t} onClick={() => { setType(t); setError('') }}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: type === t ? 'var(--color-primary)' : 'transparent', color: type === t ? 'white' : '#9ca3af' }}>
            {t === 'expense' ? '💸 지출' : '💰 수입'}
          </button>
        ))}
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">금액 *</label>
        <div className="flex items-center">
          <span className="font-semibold mr-1 text-lg" style={{ color: 'var(--color-primary)' }}>₩</span>
          <input className="w-full text-lg font-bold outline-none text-gray-800"
            placeholder="0" inputMode="numeric" value={form.amount}
            onChange={e => update('amount', formatAmount(e.target.value))} autoFocus />
        </div>
      </div>
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">
          {type === 'expense' ? '상호명 / 항목명 *' : '항목명 * (예: 월급, 용돈)'}
        </label>
        <input className="w-full text-sm outline-none text-gray-800"
          placeholder={type === 'expense' ? '예) 스타벅스' : '예) 월급'}
          value={form.name} onChange={e => update('name', e.target.value)} />
      </div>
      {type === 'expense' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <label className="text-xs text-gray-400 mb-2 block">카테고리 *</label>
          <div className="flex flex-wrap gap-2">
            {(CATEGORIES as readonly string[]).map(cat => (
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
        <label className="text-xs text-gray-400 mb-1 block">날짜 *</label>
        <input type="date" className="w-full text-sm outline-none text-gray-800"
          value={form.date} onChange={e => update('date', e.target.value)} />
      </div>
      {type === 'expense' && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <label className="text-xs text-gray-400 mb-2 block">결제수단 (선택)</label>
          <div className="flex flex-wrap gap-2">
            {paymentOptions.slice(0, 6).map(method => (
              <button key={method}
                onClick={() => update('payment_method', form.payment_method === method ? '' : method)}
                className="px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                style={{ background: form.payment_method === method ? 'var(--color-primary)' : '#f3f4f6', color: form.payment_method === method ? 'white' : '#6b7280' }}>
                {method}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">메모 (선택)</label>
        <input className="w-full text-sm outline-none text-gray-800"
          placeholder="간단히 남겨보세요"
          value={form.memo} onChange={e => update('memo', e.target.value)} />
      </div>
      {error && <p className="text-xs text-rose-400 px-1">{error}</p>}
      <button onClick={handleSave} disabled={saving}
        className="w-full text-white py-3.5 rounded-2xl text-sm font-medium mt-2 disabled:opacity-60"
        style={{ background: 'var(--color-primary)' }}>
        {saving ? '저장 중…' : type === 'expense' ? '지출 저장' : '수입 저장'}
      </button>
    </div>
  )
}

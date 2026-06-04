'use client'
import { useState, useEffect } from 'react'
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
  const [type, setType] = useState<'expense' | 'income'>('expense')
  const [form, setForm] = useState({
    name: prefill?.name ?? '',
    amount: prefill?.amount ? prefill.amount.toLocaleString() : '',
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
        await supabase.from('expenses').insert({
          user_id: user.id,
          name: form.name.trim(),
          amount,
          category: form.category,
          date: form.date,
          payment_method: form.payment_method || null,
          memo: form.memo || null,
          source: 'manual',
        })
      } else {
        await supabase.from('incomes').insert({
          user_id: user.id,
          name: form.name.trim(),
          amount,
          date: form.date,
          memo: form.memo || null,
          source: 'manual',
        })
      }

      showToast(type === 'expense' ? '지출이 저장됐어요!' : '수입이 저장됐어요!')
      setForm({ name: '', amount: '', category: '생활비', date: dayjs().format('YYYY-MM-DD'), payment_method: '', memo: '' })
      router.refresh()
    } catch {
      setError('저장 중 오류가 발생했어요')
    } finally {
      setSaving(false)
    }
  }

  const paymentOptions = [
    ...cards.map(c => c.name),
    ...PAYMENT_METHODS.filter(m => !cards.some(c => c.name === m)),
  ]

  return (
    <div className="space-y-3 relative">
      {/* 토스트 */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-gray-800 text-white text-sm px-4 py-2 rounded-xl shadow-lg">
          {toast}
        </div>
      )}

      {/* 유형 토글 */}
      <div className="flex bg-white rounded-2xl border border-gray-100 p-1">
        {(['expense', 'income'] as const).map(t => (
          <button key={t} onClick={() => { setType(t); setError('') }}
            className="flex-1 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{
              background: type === t ? 'var(--color-primary)' : 'transparent',
              color: type === t ? 'white' : '#9ca3af',
            }}>
            {t === 'expense' ? '💸 지출' : '💰 수입'}
          </button>
        ))}
      </div>

      {/* 금액 */}
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">금액 *</label>
        <div className="flex items-center">
          <span className="font-semibold mr-1 text-lg" style={{ color
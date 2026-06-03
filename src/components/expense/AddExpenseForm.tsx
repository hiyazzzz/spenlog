'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import dayjs from 'dayjs'

export default function AddExpenseForm() {
  const router = useRouter()
  const supabase = createClient()
  const [form, setForm] = useState({
    name: '',
    amount: '',
    category: '생활비',
    date: dayjs().format('YYYY-MM-DD'),
    payment_method: '',
    memo: '',
  })
  const [saving, setSaving] = useState(false)

  function update(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    if (!form.name || !form.amount) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('expenses').insert({
      user_id: user.id,
      name: form.name,
      amount: parseInt(form.amount.replace(/,/g, '')),
      category: form.category,
      date: form.date,
      payment_method: form.payment_method || null,
      memo: form.memo || null,
    })
    setForm({ name: '', amount: '', category: '생활비', date: dayjs().format('YYYY-MM-DD'), payment_method: '', memo: '' })
    setSaving(false)
    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">항목명</label>
        <input
          className="w-full text-sm outline-none text-gray-800"
          placeholder="예) 스타벅스"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">금액</label>
        <div className="flex items-center">
          <span className="text-[#6B1E2E] font-semibold mr-1">₩</span>
          <input
            className="w-full text-sm outline-none text-gray-800"
            placeholder="0"
            inputMode="numeric"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-2 block">카테고리</label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => update('category', cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${form.category === cat ? 'bg-[#6B1E2E] text-white' : 'bg-gray-100 text-gray-500'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">날짜</label>
        <input
          type="date"
          className="w-full text-sm outline-none text-gray-800"
          value={form.date}
          onChange={(e) => update('date', e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">결제수단</label>
        <input
          className="w-full text-sm outline-none text-gray-800"
          placeholder="예) 카카오페이, 신한카드"
          value={form.payment_method}
          onChange={(e) => update('payment_method', e.target.value)}
        />
      </div>

      <div className="bg-white rounded-2xl p-4 border border-gray-100">
        <label className="text-xs text-gray-400 mb-1 block">메모 (선택)</label>
        <input
          className="w-full text-sm outline-none text-gray-800"
          placeholder="추가 메모"
          value={form.memo}
          onChange={(e) => update('memo', e.target.value)}
        />
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#6B1E2E] text-white py-3.5 rounded-2xl text-sm font-medium mt-2 disabled:opacity-60"
      >
        {saving ? '저장 중…' : '저장하기'}
      </button>
    </div>
  )
}

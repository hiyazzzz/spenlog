'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { FixedCost, FixedCostType } from '@/types'

const TYPES: FixedCostType[] = ['월정액', '연정액', '기타']

interface Props {
  initialItems: FixedCost[]
  userId: string
}

export default function FixedCostList({ initialItems, userId }: Props) {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<FixedCostType>('월정액')
  const [dueDay, setDueDay] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!name.trim() || !amount) return
    setSaving(true)
    const supabase = createClient()
    await supabase.from('fixed_costs').insert({
      user_id: userId,
      name: name.trim(),
      amount: Number(amount),
      type,
      due_day: dueDay ? Number(dueDay) : null,
    })
    setName(''); setAmount(''); setDueDay(''); setType('월정액')
    setShowForm(false)
    setSaving(false)
    router.refresh()
  }

  const handleDelete = async (id: string) => {
    const supabase = createClient()
    await supabase.from('fixed_costs').delete().eq('id', id)
    router.refresh()
  }

  return (
    <div>
      {/* 목록 */}
      <div className="bg-white rounded-2xl border border-gray-100 mb-4 overflow-hidden">
        {initialItems.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">등록된 고정비가 없어요.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {initialItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-gray-800">{item.name}</p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {item.type}{item.due_day ? ` · 매월 ${item.due_day}일` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-gray-900">
                    {item.amount.toLocaleString()}원
                  </span>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="text-xs text-gray-300 hover:text-rose-400 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 추가 폼 */}
      {showForm ? (
        <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-3">
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#6B1E2E]"
            placeholder="항목명 (예: 넷플릭스)"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#6B1E2E]"
            placeholder="금액"
            type="number"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <div className="flex gap-2">
            {TYPES.map(t => (
              <button
                key={t}
                onClick={() => setType(t)}
                className={`flex-1 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                  type === t ? 'bg-[#6B1E2E] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-[#6B1E2E]"
            placeholder="결제일 (선택, 숫자만)"
            type="number"
            min="1"
            max="31"
            value={dueDay}
            onChange={e => setDueDay(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="flex-1 py-2 rounded-xl text-sm bg-gray-100 text-gray-500"
            >
              취소
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm bg-[#6B1E2E] text-white font-medium disabled:opacity-50"
            >
              {saving ? '저장 중…' : '추가'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 hover:border-[#6B1E2E] hover:text-[#6B1E2E] transition-colors"
        >
          + 고정비 추가
        </button>
      )}
    </div>
  )
}

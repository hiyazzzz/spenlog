'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CATEGORIES } from '@/lib/themes'
import { Budget } from '@/types'

interface Props {
  userId: string
  initialBudgets: Budget[]
}

export default function BudgetForm({ userId, initialBudgets }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [amounts, setAmounts] = useState<Record<string, string>>(
    Object.fromEntries(CATEGORIES.map(cat => [
      cat, 
      initialBudgets.find(b => b.category === cat)?.amount.toString() || ''
    ]))
  )

  function handleChange(cat: string, value: string) {
    setAmounts(prev => ({ ...prev, [cat]: value.replace(/[^0-9]/g, '') }))
  }

  async function handleSave() {
    setLoading(true)
    
    const upsertData = CATEGORIES.map(cat => ({
      user_id: userId,
      category: cat,
      amount: parseInt(amounts[cat] || '0'),
    }))

    await supabase.from('budgets').upsert(upsertData, {
      onConflict: 'user_id,category'
    })

    setLoading(false)
    alert('예산이 성공적으로 저장되었습니다!')
    window.location.reload()
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {CATEGORIES.map((cat) => (
          <div key={cat} className="bg-white rounded-2xl p-4 border border-gray-100 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-700">{cat}</span>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 text-sm">₩</span>
              <input
                type="text"
                inputMode="numeric"
                className="w-32 text-right text-sm font-semibold outline-none text-gray-800 placeholder:text-gray-200"
                placeholder="0"
                value={amounts[cat]}
                onChange={(e) => handleChange(cat, e.target.value)}
              />
            </div>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        disabled={loading}
        className="w-full bg-[#6B1E2E] text-white py-3.5 rounded-2xl text-sm font-medium disabled:opacity-50"
      >
        {loading ? '저장 중...' : '예산 저장하기'}
      </button>
    </div>
  )
}
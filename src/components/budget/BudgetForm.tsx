'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { CATEGORIES } from '@/lib/themes'
import { Budget } from '@/types'

interface Expense { category: string; amount: number }
interface Props {
  userId: string
  initialBudgets: Budget[]
  expenses: Expense[]
  thisMonth: string
}

export default function BudgetForm({ userId, initialBudgets, expenses, thisMonth }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)
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
      month: thisMonth,
    }))
    await supabase.from('budgets').upsert(upsertData, { onConflict: 'user_id,category,month' })
    setLoading(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    router.refresh()
  }

  const totalBudget = CATEGORIES.reduce((s, c) => s + (parseInt(amounts[c] || '0') || 0), 0)
  const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0

  return (
    <div className="space-y-4">
      {totalBudget > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex justify-between text-xs mb-2">
            <span className="text-gray-500 font-medium">전체 예산 달성률</span>
            <span className={`font-bold ${overallPct > 100 ? 'text-rose-500' : overallPct >= 80 ? 'text-amber-500' : 'text-emerald-600'}`}>
              {overallPct}%
            </span>
          </div>
          <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${Math.min(overallPct, 100)}%`,
              background: overallPct > 100 ? '#EF4444' : overallPct >= 80 ? '#F59E0B' : 'var(--color-primary)',
            }} />
          </div>
          <div className="flex justify-between text-[11px] text-gray-400 mt-1.5">
            <span>지출 ₩{totalSpent.toLocaleString()}</span>
            <span>예산 ₩{totalBudget.toLocaleString()}</span>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {CATEGORIES.map((cat) => {
          const spent = expenses.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0)
          const budget = parseInt(amounts[cat] || '0') || 0
          const pct = budget > 0 ? Math.round((spent / budget) * 100) : 0
          const over = spent > budget && budget > 0

          return (
            <div key={cat} className="bg-white rounded-2xl p-4 border border-gray-100">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">{cat}</span>
                <div className="flex items-center gap-1">
                  <span className="text-gray-400 text-sm">₩</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    className="w-28 text-right text-sm font-semibold outline-none text-gray-800 placeholder:text-gray-200"
                    placeholder="0"
                    value={amounts[cat]}
                    onChange={(e) => handleChange(cat, e.target.value)}
                  />
                </div>
              </div>
              {budget > 0 && (
                <div>
                  <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden mb-1">
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(pct, 100)}%`,
                      background: over ? '#EF4444' : pct >= 80 ? '#F59E0B' : 'var(--color-primary)',
                    }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span className={over ? 'text-rose-400 font-medium' : ''}>
                      {spent > 0 ? `지출 ₩${spent.toLocaleString()}` : '지출 없음'}
                    </span>
                    <span>{pct}%{over ? ' 초과!' : ''}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <button onClick={handleSave} disabled={loading} style={{
        width: '100%', padding: '14px', borderRadius: '16px',
        background: saved ? '#2E7D52' : loading ? '#C4A0A8' : 'var(--color-primary)',
        color: '#fff', fontSize: '14px', fontWeight: '600', border: 'none',
        cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s',
        fontFamily: 'inherit',
      }}>
        {loading ? '저장 중...' : saved ? '✓ 저장됨' : '예산 저장하기'}
      </button>
    </div>
  )
}

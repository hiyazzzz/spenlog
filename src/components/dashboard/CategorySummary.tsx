'use client'
import { Category, Expense, Budget } from '@/types'
import { CATEGORIES } from '@/lib/themes'

interface Props {
  expenses: Expense[]
  budgets: Budget[]
}

export default function CategorySummary({ expenses, budgets }: Props) {
  const budgetMap = Object.fromEntries(budgets.map((b) => [b.category, b.amount]))
  
  const spentMap = Object.fromEntries(
    CATEGORIES.map((cat) => [
      cat,
      expenses.filter((e) => e.category === cat).reduce((sum, e) => sum + e.amount, 0),
    ])
  )

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">카테고리별 소비</h3>
      <div className="space-y-4">
        {CATEGORIES.map((cat) => {
          const spent = spentMap[cat] ?? 0
          const budget = budgetMap[cat] ?? 0
          const percent = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0

          return (
            <div key={cat} className="space-y-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-gray-500">{cat}</span>
                <span className="text-gray-800">
                  ₩{spent.toLocaleString()}
                  {budget > 0 && <span className="text-gray-400 font-normal"> / ₩{budget.toLocaleString()}</span>}
                </span>
              </div>
              <div className="bg-gray-50 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-[#6B1E2E] rounded-full transition-all duration-500"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
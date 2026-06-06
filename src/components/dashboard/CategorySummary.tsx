'use client'

interface Budget { id: string; category: string; amount: number }
interface Expense { category: string; amount: number; type?: string }

interface Props {
  expenses: Expense[]
  budgets: Budget[]
  compact?: boolean
  userCategories?: string[]
}

export default function CategorySummary({ expenses, budgets, compact, userCategories }: Props) {
  const safeBudgets = budgets || []
  const safeExpenses = (expenses || []).filter(e => e.type !== 'income' && e.type !== 'transfer')

  const catMap: Record<string, number> = {}
  safeExpenses.forEach(e => {
    catMap[e.category] = (catMap[e.category] ?? 0) + Number(e.amount)
  })

  const allCats = userCategories && userCategories.length > 0
    ? userCategories
    : [...new Set([...Object.keys(catMap), ...safeBudgets.map(b => b.category)])]

  const displayCats = allCats.filter(cat =>
    (catMap[cat] ?? 0) > 0 || safeBudgets.find(b => b.category === cat)
  )

  const totalSpent = safeExpenses.reduce((s, e) => s + Number(e.amount), 0)
  const totalBudget = safeBudgets.reduce((s, b) => s + Number(b.amount), 0)

  const sortedCats = [...displayCats].sort((a, b) => (catMap[b] ?? 0) - (catMap[a] ?? 0))
  const visibleCats = compact ? sortedCats.slice(0, 3) : sortedCats

  return (
    <div className={compact ? '' : 'bg-white rounded-2xl border border-gray-100 overflow-hidden'}
      style={compact ? undefined : { minHeight: 160, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
      <div className={compact ? '' : 'p-5'}>
        {!compact && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-gray-900">카테고리별 지출 현황</h2>
            {totalBudget > 0 && (
              <span className="text-xs text-gray-400">
                예산 {totalBudget.toLocaleString()}원 중 {totalSpent.toLocaleString()}원
              </span>
            )}
          </div>
        )}

        {displayCats.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-2xl mb-2">🌿</p>
            <p className={`${compact ? 'text-xs' : 'text-sm'} text-gray-400`}>
              아직 이번 달 지출이 없어요.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleCats.map(cat => {
              const spent = Number(catMap[cat] ?? 0)
              const budget = Number(safeBudgets.find(b => b.category === cat)?.amount ?? 0)
              const pct = budget > 0 ? Math.min(Math.round((spent / budget) * 100), 100) : 0
              const over = budget > 0 && spent > budget
              const barColor = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--color-primary)'
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-gray-700">{cat}</span>
                      {over && (
                        <span className="text-[10px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full font-semibold">초과</span>
                      )}
                      {!over && pct >= 70 && pct < 100 && budget > 0 && (
                        <span className="text-[10px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-full font-semibold">{pct}%</span>
                      )}
                    </div>
                    <span className="text-xs font-bold text-gray-800">
                      {spent.toLocaleString()}원
                      {budget > 0 && <span className="text-gray-400 font-normal"> / {budget.toLocaleString()}원</span>}
                    </span>
                  </div>
                  {budget > 0 && (
                    <div className="bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: barColor }} />
                    </div>
                  )}
                </div>
              )
            })}
            {compact && sortedCats.length > 3 && (
              <p className="text-[11px] text-gray-400 text-center pt-1">
                +{sortedCats.length - 3}개 카테고리 더 있음
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

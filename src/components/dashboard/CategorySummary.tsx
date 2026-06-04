'use client';

interface Budget { id: string; category: string; amount: number }
interface Expense { category: string; amount: number }

interface Props { expenses: Expense[]; budgets: Budget[] }

export default function CategorySummary({ expenses, budgets }: Props) {
  const safeBudgets = budgets || []
  const totalBudget = safeBudgets.reduce((s, b) => s + b.amount, 0)
  const totalSpent = (expenses || []).reduce((s, e) => s + e.amount, 0)
  const overallPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0
  const overallOver = totalSpent > totalBudget && totalBudget > 0

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-sm font-bold text-gray-900">카테고리별 지출 현황</h2>
        {totalBudget > 0 && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            overallOver ? 'bg-rose-50 text-rose-500' :
            overallPct >= 80 ? 'bg-amber-50 text-amber-500' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            전체 {overallPct}%
          </span>
        )}
      </div>

      {safeBudgets.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          설정된 예산이 없습니다. 예산 페이지에서 등록해 보세요!
        </p>
      ) : (
        <div className="space-y-4">
          {safeBudgets.map((budget) => {
            const spent = (expenses || [])
              .filter(e => e.category === budget.category)
              .reduce((s, e) => s + e.amount, 0)
            const amt = budget.amount ?? 0
            const pct = amt > 0 ? Math.min(Math.round((spent / amt) * 100), 100) : 0
            const over = spent > amt && amt > 0
            const warn = !over && pct >= 80

            const barColor = over
              ? '#EF4444'
              : warn
              ? '#F59E0B'
              : 'var(--color-primary)'

            return (
              <div key={budget.id}>
                <div className="flex justify-between text-xs font-medium mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-700">{budget.category}</span>
                    {over && (
                      <span className="text-[10px] bg-rose-50 text-rose-500 px-1.5 py-0.5 rounded-full font-semibold">
                        초과!
                      </span>
                    )}
                    {warn && !over && (
                      <span className="text-[10px] bg-amber-50 text-amber-500 px-1.5 py-0.5 rounded-full font-semibold">
                        주의
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={over ? 'text-rose-500 font-bold' : warn ? 'text-amber-500' : 'text-gray-500'}>
                      {pct}%
                    </span>
                    <span className={over ? 'text-rose-500 font-bold' : 'text-gray-500'}>
                      {spent.toLocaleString()} / {amt.toLocaleString()}원
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${amt > 0 ? Math.min((spent / amt) * 100, 100) : 0}%`,
                      background: barColor,
                    }}
                  />
                </div>
                {over && (
                  <p className="text-[10px] text-rose-400 mt-0.5 text-right">
                    {(spent - amt).toLocaleString()}원 초과
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

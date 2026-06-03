'use client';

interface CategorySummaryProps {
  expenses: any[];
  budgets: any[];
}

export default function CategorySummary({ expenses, budgets }: CategorySummaryProps) {
  // budgets가 부실할 경우를 대비해 안전하게 빈 배열을 기본값으로 바인딩합니다.
  const safeBudgets = budgets || [];

  return (
    <div className="p-6 bg-white rounded-2xl shadow-sm border border-gray-100">
      <h2 className="text-sm font-bold text-gray-900 mb-4">카테고리별 지출 현황</h2>
      
      {/* ?. 안전장치와 safeBudgets를 활용해 에러를 원천 차단합니다 */}
      {safeBudgets.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">
          설정된 예산이 없습니다. 예산 페이지에서 등록해 보세요!
        </p>
      ) : (
        <div className="space-y-4">
          {safeBudgets.map((budget) => {
            // 해당 카테고리의 실제 지출 합산 (expenses가 null일 경우 대비해 기본 배열 처리)
            const categorySpent = (expenses || [])
              .filter((e) => e.category === budget.category)
              .reduce((sum, e) => sum + e.amount, 0);

            // 예산 금액이 0보다 클 때만 퍼센트를 연산하여 나눗셈 에러(NaN)를 방지합니다.
            const budgetAmount = budget.amount ?? 0;
            const percentage = budgetAmount > 0 ? Math.min(Math.round((categorySpent / budgetAmount) * 100), 100) : 0;
            const isOverBudget = categorySpent > budgetAmount;

            return (
              <div key={budget.id} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="text-gray-700">{budget.category}</span>
                  <span className={isOverBudget ? 'text-red-500 font-bold' : 'text-gray-500'}>
                    {categorySpent.toLocaleString()} / {budgetAmount.toLocaleString()}원 ({percentage}%)
                  </span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      isOverBudget ? 'bg-red-500' : 'bg-[#802634]'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}